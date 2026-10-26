import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { prisma } from '../src/lib/prisma';
import { hashToken } from '../src/lib/crypto';
import {
  registerLimiter,
  loginLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  changePasswordLimiter,
} from '../src/middleware/rateLimit';
import jwt from 'jsonwebtoken';

const app = createApp();

const getCookie = (res: request.Response, name: string): string | undefined => {
  const setCookies = res.headers['set-cookie'];
  if (!setCookies) {
    return undefined;
  }
  const cookie = Array.isArray(setCookies) ? setCookies : [setCookies];
  const match = cookie.find((c) => c.startsWith(`${name}=`));
  return match ? match.split(';')[0] : undefined;
};

const getSetCookie = (res: request.Response, name: string): string | undefined => {
  const setCookies = res.headers['set-cookie'];
  if (!setCookies) {
    return undefined;
  }
  const cookie = Array.isArray(setCookies) ? setCookies : [setCookies];
  return cookie.find((c) => c.startsWith(`${name}=`));
};

const joinCookies = (...cookies: Array<string | undefined>): string =>
  cookies.filter((cookie): cookie is string => Boolean(cookie)).join('; ');

const getCsrf = async (): Promise<{ cookie: string; token: string }> => {
  const res = await request(app).get('/api/auth/csrf');
  const cookie = getCookie(res, 'csrf_token');
  const token = res.body?.data?.csrfToken;

  if (res.status !== 200 || !cookie || typeof token !== 'string' || !token) {
    throw new Error(`Failed to obtain a CSRF token: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return { cookie, token };
};

const postWithCsrf = async (
  path: string,
  body?: Record<string, unknown>,
  cookies: Array<string | undefined> = []
): Promise<request.Response> => {
  const csrf = await getCsrf();
  let req = request(app)
    .post(path)
    .set('Cookie', joinCookies(csrf.cookie, ...cookies))
    .set('X-XSRF-TOKEN', csrf.token);

  if (body !== undefined) {
    req = req.send(body);
  }

  return req;
};

const registerUser = async (
  payload: Record<string, unknown> = registerPayload
): Promise<request.Response> => {
  const res = await postWithCsrf('/api/auth/register', payload);
  if (res.status !== 201) {
    throw new Error(`Registration failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res;
};

const resetRateLimits = async (): Promise<void> => {
  const limiters = [
    registerLimiter,
    loginLimiter,
    forgotPasswordLimiter,
    resetPasswordLimiter,
    changePasswordLimiter,
  ];
  // Supertest requests originate from localhost; cover the common loopback keys.
  const keys = ['127.0.0.1', '::1', '::/56', '::ffff:127.0.0.1', '::ffff:7f00:1'];

  for (const limiter of limiters) {
    for (const key of keys) {
      await limiter.resetKey(key);
    }
  }
};

const registerPayload = {
  name: 'Test User',
  email: 'test.user@example.com',
  password: 'Password1',
  confirmPassword: 'Password1',
};

describe('Auth API', () => {
  beforeEach(async () => {
    await resetRateLimits();
    await prisma.user.deleteMany({});
  });

  describe('POST /api/auth/register', () => {
    it('registers a new user and returns a safe user without passwordHash', async () => {
      const res = await postWithCsrf('/api/auth/register', {
        name: 'Test User',
        email: '  Test.User@Example.COM ',
        password: 'Password1',
        confirmPassword: 'Password1',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toMatchObject({
        email: 'test.user@example.com',
        name: 'Test User',
      });
      expect(res.body.data.user).not.toHaveProperty('passwordHash');

      const authCookie = getCookie(res, 'auth_token');
      expect(authCookie).toBeDefined();
      expect(authCookie).toContain('auth_token=');
    });

    it('registers without a CSRF token', async () => {
      const res = await request(app).post('/api/auth/register').send(registerPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(await prisma.user.count()).toBe(1);
    });

    it('registers without a CSRF token while still validating the payload', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...registerPayload, password: 'weak', confirmPassword: 'weak' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(await prisma.user.count()).toBe(0);
    });

    it('registers without a CSRF token but still hashes the password', async () => {
      const res = await request(app).post('/api/auth/register').send(registerPayload);

      expect(res.status).toBe(201);
      const user = await prisma.user.findUnique({
        where: { email: 'test.user@example.com' },
      });
      expect(user?.passwordHash).toBeDefined();
      expect(user?.passwordHash).not.toBe('Password1');
    });

    it('rejects duplicate registration with 409', async () => {
      const first = await registerUser();
      expect(first.status).toBe(201);

      const second = await postWithCsrf('/api/auth/register', registerPayload);
      expect(second.status).toBe(409);
      expect(second.body.success).toBe(false);
    });

    it('rejects invalid payloads with 400', async () => {
      const weakPassword = await postWithCsrf('/api/auth/register', {
        ...registerPayload,
        password: 'weak',
        confirmPassword: 'weak',
      });
      expect(weakPassword.status).toBe(400);

      const mismatch = await postWithCsrf('/api/auth/register', {
        ...registerPayload,
        confirmPassword: 'Different1',
      });
      expect(mismatch.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in successfully and sets an auth cookie', async () => {
      await registerUser();

      const res = await postWithCsrf('/api/auth/login', {
        email: 'test.user@example.com',
        password: 'Password1',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('test.user@example.com');
      expect(getCookie(res, 'auth_token')).toBeDefined();
    });

    it('returns a generic error for invalid credentials', async () => {
      await registerUser();

      const res = await postWithCsrf('/api/auth/login', {
        email: 'test.user@example.com',
        password: 'WrongPassword1',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 401 without an auth cookie', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns the authenticated user profile with a valid cookie', async () => {
      await registerUser();
      const loginRes = await postWithCsrf('/api/auth/login', {
        email: 'test.user@example.com',
        password: 'Password1',
      });
      const authCookie = getCookie(loginRes, 'auth_token');

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', authCookie as string);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('test.user@example.com');
    });

    it('rejects a malformed JWT with 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', 'auth_token=not-a-valid-jwt');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('rejects an expired JWT with 401', async () => {
      const token = jwt.sign(
        {
          sub: '00000000-0000-0000-0000-000000000000',
          email: 'expired@example.com',
          tv: 0,
          exp: Math.floor(Date.now() / 1000) - 100,
        },
        'test-jwt-secret-which-is-long-enough-0123456789'
      );
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', `auth_token=${token}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears the auth cookie and returns success', async () => {
      await registerUser();
      const loginRes = await postWithCsrf('/api/auth/login', {
        email: 'test.user@example.com',
        password: 'Password1',
      });
      const authCookie = getCookie(loginRes, 'auth_token');

      const res = await postWithCsrf('/api/auth/logout', {}, [authCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', authCookie as string);
      expect(meRes.status).toBe(401);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('returns a generic response for an unknown email', async () => {
      const res = await postWithCsrf('/api/auth/forgot-password', {
        email: 'unknown@example.com',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBeDefined();
    });

    it('creates a hashed single-use reset token for an existing user', async () => {
      await registerUser();

      const res = await postWithCsrf('/api/auth/forgot-password', {
        email: 'test.user@example.com',
      });

      expect(res.status).toBe(200);

      const tokens = await prisma.passwordResetToken.findMany({
        where: { user: { email: 'test.user@example.com' } },
      });
      expect(tokens).toHaveLength(1);
      expect(tokens[0].usedAt).toBeNull();
      expect(tokens[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(tokens[0].tokenHash).not.toBe('some-raw-token');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    const rawToken = 'valid-reset-token-abcdef123456';

    beforeEach(async () => {
      await registerUser();

      const user = await prisma.user.findUnique({
        where: { email: 'test.user@example.com' },
      });
      if (!user) {
        throw new Error('Expected the registered test user to exist.');
      }

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });
    });

    it('rejects an invalid reset token', async () => {
      const res = await postWithCsrf('/api/auth/reset-password', {
        token: 'invalid-token',
        password: 'NewPassword2',
        confirmPassword: 'NewPassword2',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('RESET_TOKEN_INVALID');
    });

    it('resets the password with a valid token and consumes it', async () => {
      const res = await postWithCsrf('/api/auth/reset-password', {
        token: rawToken,
        password: 'NewPassword2',
        confirmPassword: 'NewPassword2',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const user = await prisma.user.findUnique({
        where: { email: 'test.user@example.com' },
      });
      expect(user).toBeDefined();
      expect(user?.passwordHash).not.toBeNull();
      const isNewPasswordValid = await import('bcryptjs').then((bcrypt) =>
        bcrypt.compare('NewPassword2', user!.passwordHash)
      );
      expect(isNewPasswordValid).toBe(true);

      const tokenRecord = await prisma.passwordResetToken.findFirst({
        where: { tokenHash: hashToken(rawToken) },
      });
      expect(tokenRecord?.usedAt).not.toBeNull();
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('requires authentication', async () => {
      const res = await postWithCsrf('/api/auth/change-password', {
        currentPassword: 'Password1',
        newPassword: 'NewPassword2',
        confirmPassword: 'NewPassword2',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('changes the password and invalidates the existing session', async () => {
      await registerUser();
      const loginRes = await postWithCsrf('/api/auth/login', {
        email: 'test.user@example.com',
        password: 'Password1',
      });
      const authCookie = getCookie(loginRes, 'auth_token');

      const res = await postWithCsrf(
        '/api/auth/change-password',
        { currentPassword: 'Password1', newPassword: 'NewPassword2', confirmPassword: 'NewPassword2' },
        [authCookie]
      );

      expect(res.status).toBe(200);

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', authCookie as string);
      expect(meRes.status).toBe(401);

      const oldLogin = await postWithCsrf('/api/auth/login', {
        email: 'test.user@example.com',
        password: 'Password1',
      });
      expect(oldLogin.status).toBe(401);

      const newLogin = await postWithCsrf('/api/auth/login', {
        email: 'test.user@example.com',
        password: 'NewPassword2',
      });
      expect(newLogin.status).toBe(200);
    });
  });

  describe('CORS for the frontend origin', () => {
    it('allows credentialed preflight requests with the X-XSRF-TOKEN header', async () => {
      const res = await request(app)
        .options('/api/auth/register')
        .set('Origin', env.FRONTEND_URL)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type,x-xsrf-token');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(env.FRONTEND_URL);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['access-control-allow-headers']?.toLowerCase()).toContain('x-xsrf-token');
    });

    it('registers a cross-origin request with credentials', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('Origin', env.FRONTEND_URL)
        .send(registerPayload);

      expect(res.status).toBe(201);
      expect(res.headers['access-control-allow-origin']).toBe(env.FRONTEND_URL);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('CSRF protection', () => {
    const protectedPostEndpoints: Array<[string, Record<string, unknown>]> = [
      ['/api/auth/login', { email: 'test.user@example.com', password: 'Password1' }],
      ['/api/auth/logout', {}],
      ['/api/auth/forgot-password', { email: 'test.user@example.com' }],
      [
        '/api/auth/reset-password',
        { token: 'invalid-token', password: 'NewPassword2', confirmPassword: 'NewPassword2' },
      ],
      [
        '/api/auth/change-password',
        { currentPassword: 'Password1', newPassword: 'NewPassword2', confirmPassword: 'NewPassword2' },
      ],
    ];

    it('issues a CSRF token and matching cookie from GET /api/auth/csrf', async () => {
      const res = await request(app).get('/api/auth/csrf');

      expect(res.status).toBe(200);
      const csrfToken = res.body.data.csrfToken;
      const csrfCookie = getCookie(res, 'csrf_token');
      const csrfSetCookie = getSetCookie(res, 'csrf_token');

      expect(csrfToken).toMatch(/^[a-f0-9]{64}$/);
      expect(csrfCookie).toBe(`csrf_token=${csrfToken}`);
      expect(csrfSetCookie).toMatch(/Path=\//i);
      expect(csrfSetCookie).toMatch(/SameSite=Lax/i);
      expect(csrfSetCookie).not.toMatch(/HttpOnly/i);
    });

    it.each(protectedPostEndpoints)(
      'rejects %s without a CSRF token',
      async (path, body) => {
        const res = await request(app).post(path).send(body);

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('CSRF_ERROR');
      }
    );

    it.each(protectedPostEndpoints)(
      'rejects %s with a mismatched CSRF token',
      async (path, body) => {
        const csrf = await getCsrf();
        const mismatchedToken = `${csrf.token[0] === '0' ? '1' : '0'}${csrf.token.slice(1)}`;

        const res = await request(app)
          .post(path)
          .set('Cookie', csrf.cookie)
          .set('X-XSRF-TOKEN', mismatchedToken)
          .send(body);

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('CSRF_ERROR');
      }
    );

    it('allows state-changing requests with a matching CSRF token', async () => {
      const regRes = await registerUser();
      const authCookie = getCookie(regRes, 'auth_token');

      const res = await postWithCsrf(
        '/api/auth/login',
        { email: 'test.user@example.com', password: 'Password1' },
        [authCookie]
      );

      expect(res.status).toBe(200);
    });
  });
});
