import request from 'supertest';
import { createApp } from '../src/app';
import {
  changePasswordLimiter,
  deleteAccountLimiter,
  forgotPasswordLimiter,
  leadWriteLimiter,
  loginLimiter,
  registerLimiter,
  resetPasswordLimiter,
} from '../src/middleware/rateLimit';

export const app = createApp();

export const AUTH_COOKIE = 'auth_token';
export const CSRF_COOKIE = 'csrf_token';

export const getCookie = (res: request.Response, name: string): string | undefined => {
  const setCookies = res.headers['set-cookie'];
  if (!setCookies) {
    return undefined;
  }
  const cookies = Array.isArray(setCookies) ? setCookies : [setCookies];
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  return match ? match.split(';')[0] : undefined;
};

export const getSetCookie = (res: request.Response, name: string): string | undefined => {
  const setCookies = res.headers['set-cookie'];
  if (!setCookies) {
    return undefined;
  }
  const cookies = Array.isArray(setCookies) ? setCookies : [setCookies];
  return cookies.find((cookie) => cookie.startsWith(`${name}=`));
};

export const joinCookies = (...cookies: Array<string | undefined>): string =>
  cookies.filter((cookie): cookie is string => Boolean(cookie)).join('; ');

export const getCsrf = async (): Promise<{ cookie: string; token: string }> => {
  const res = await request(app).get('/api/auth/csrf');
  const cookie = getCookie(res, CSRF_COOKIE);
  const token = res.body?.data?.csrfToken;

  if (res.status !== 200 || !cookie || typeof token !== 'string' || !token) {
    throw new Error(`Failed to obtain a CSRF token: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return { cookie, token };
};

type UnsafeMethod = 'post' | 'patch' | 'put' | 'delete';

export const sendWithCsrf = async (
  method: UnsafeMethod,
  path: string,
  body?: Record<string, unknown>,
  cookies: Array<string | undefined> = []
): Promise<request.Response> => {
  const csrf = await getCsrf();
  let req = request(app)
    [method](path)
    .set('Cookie', joinCookies(csrf.cookie, ...cookies))
    .set('X-XSRF-TOKEN', csrf.token);

  if (body !== undefined) {
    req = req.send(body);
  }

  return req;
};

export const postWithCsrf = (
  path: string,
  body?: Record<string, unknown>,
  cookies: Array<string | undefined> = []
): Promise<request.Response> => sendWithCsrf('post', path, body, cookies);

export const patchWithCsrf = (
  path: string,
  body?: Record<string, unknown>,
  cookies: Array<string | undefined> = []
): Promise<request.Response> => sendWithCsrf('patch', path, body, cookies);

export const deleteWithCsrf = (
  path: string,
  body?: Record<string, unknown>,
  cookies: Array<string | undefined> = []
): Promise<request.Response> => sendWithCsrf('delete', path, body, cookies);

export const getWithCookies = (path: string, cookies: Array<string | undefined>): Promise<request.Response> =>
  request(app)
    .get(path)
    .set('Cookie', joinCookies(...cookies));

export const defaultRegisterPayload = {
  name: 'Test User',
  email: 'test.user@example.com',
  password: 'Password1',
  confirmPassword: 'Password1',
};

export const registerUser = async (
  payload: Record<string, unknown> = defaultRegisterPayload
): Promise<request.Response> => {
  const res = await postWithCsrf('/api/auth/register', payload);
  if (res.status !== 201) {
    throw new Error(`Registration failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res;
};

export const loginUser = async (
  email: string,
  password: string
): Promise<request.Response> => postWithCsrf('/api/auth/login', { email, password });

export const resetRateLimits = async (): Promise<void> => {
  const limiters = [
    registerLimiter,
    loginLimiter,
    forgotPasswordLimiter,
    resetPasswordLimiter,
    changePasswordLimiter,
    deleteAccountLimiter,
    leadWriteLimiter,
  ];
  const keys = ['127.0.0.1', '::1', '::/56', '::ffff:127.0.0.1', '::ffff:7f00:1'];

  for (const limiter of limiters) {
    for (const key of keys) {
      await limiter.resetKey(key);
    }
  }
};
