import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { hashToken } from '../src/lib/crypto';
import {
  buildFrontendUrl,
  clearEmailOutbox,
  getEmailOutbox,
  resetEmailServiceForTests,
} from '../src/services/email.service';
import { renderWelcomeEmail } from '../src/emails/templates/welcome';
import { renderPasswordResetEmail } from '../src/emails/templates/password-reset';
import { renderPasswordChangedEmail } from '../src/emails/templates/password-changed';
import { renderAccountDeletedEmail } from '../src/emails/templates/account-deleted';
import type { EmailBrand } from '../src/emails/types';
import {
  AUTH_COOKIE,
  defaultRegisterPayload,
  getCookie,
  postWithCsrf,
  registerUser,
  resetRateLimits,
} from './helpers';

const brand: EmailBrand = {
  appName: 'LeadDesk',
  supportEmail: 'support@leadtest.example',
  frontendUrl: 'https://app.leadtest.example',
};

const passwordResetPayload = {
  password: 'NewPassword2',
  confirmPassword: 'NewPassword2',
};

const createResetToken = async (rawToken: string, expiresAt: Date): Promise<string> => {
  const user = await prisma.user.findUnique({ where: { email: defaultRegisterPayload.email } });
  if (!user) {
    throw new Error('Expected the registered user.');
  }

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt,
    },
  });

  return user.id;
};

describe('Transactional email templates', () => {
  it('renders a responsive, table-based welcome email with an absolute dashboard link', () => {
    const email = renderWelcomeEmail({
      brand,
      name: 'Ada Lovelace',
      dashboardUrl: 'https://app.leadtest.example/app/dashboard',
    });

    expect(email.subject).toBe('Welcome to LeadDesk');
    expect(email.html).toContain('<!doctype html>');
    expect(email.html).toContain('<table role="presentation"');
    expect(email.html).toContain('prefers-color-scheme: dark');
    expect(email.html).toContain('https://app.leadtest.example/app/dashboard');
    expect(email.html).toContain('support@leadtest.example');
    expect(email.html).toContain('Ada Lovelace');
    expect(email.text).toContain('Welcome aboard, Ada Lovelace');
    expect(email.text).toContain('https://app.leadtest.example/app/dashboard');
    expect(email.text).not.toContain('<table');
  });

  it('escapes user-supplied names in HTML while keeping the plain-text version readable', () => {
    const email = renderWelcomeEmail({
      brand,
      name: '<script>alert("x")</script>',
      dashboardUrl: 'https://app.leadtest.example/app/dashboard',
    });

    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.text).toContain('<script>alert("x")</script>');
  });

  it('renders a time-limited password reset email', () => {
    const email = renderPasswordResetEmail({
      brand,
      name: 'Grace Hopper',
      resetUrl: 'https://app.leadtest.example/reset-password?token=abc123',
      expiresInMinutes: 30,
    });

    expect(email.subject).toBe('Reset your LeadDesk password');
    expect(email.html).toContain('expires in 30 minutes');
    expect(email.html).toContain('https://app.leadtest.example/reset-password?token=abc123');
    expect(email.html).toContain('can only be used once');
    expect(email.text).toContain('https://app.leadtest.example/reset-password?token=abc123');
    expect(email.text).toMatch(/did not request/i);
  });

  it('renders a password-changed security notification with an unauthorized-change warning', () => {
    const email = renderPasswordChangedEmail({
      brand,
      name: 'Katherine Johnson',
      changedAt: new Date('2026-10-26T12:00:00.000Z'),
      securityUrl: 'https://app.leadtest.example/app/settings',
    });

    expect(email.subject).toBe('Your LeadDesk password was changed');
    expect(email.html).toContain('All existing sessions were signed out');
    expect(email.html).toMatch(/did not make this change/i);
    expect(email.html).toContain('https://app.leadtest.example/app/settings');
    expect(email.html).toContain('Oct 26, 2026');
    expect(email.text).toMatch(/reset your password immediately/i);
  });

  it('renders an account-deletion confirmation without unnecessary personal information', () => {
    const email = renderAccountDeletedEmail({
      brand,
      deletedAt: new Date('2026-10-26T12:00:00.000Z'),
      registerUrl: 'https://app.leadtest.example/register',
    });

    expect(email.subject).toBe('Your LeadDesk account has been deleted');
    expect(email.html).toMatch(/permanently deleted/i);
    expect(email.html).toContain('https://app.leadtest.example/register');
    expect(email.html).toContain('support@leadtest.example');
    expect(email.text).toMatch(/cannot be undone/i);
    expect(email.text).not.toContain('passwordHash');
  });

  it('builds links only from the validated frontend base URL', () => {
    expect(buildFrontendUrl('/app/dashboard')).toBe('http://localhost:5173/app/dashboard');
    expect(buildFrontendUrl('reset-password?token=abc')).toBe(
      'http://localhost:5173/reset-password?token=abc'
    );
  });
});

describe('Email triggers', () => {
  beforeEach(async () => {
    await resetRateLimits();
    resetEmailServiceForTests();
    await prisma.user.deleteMany({});
  });

  it('sends a welcome email only after successful registration', async () => {
    await registerUser();

    const outbox = getEmailOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      to: defaultRegisterPayload.email,
      template: 'welcome',
      subject: 'Welcome to LeadDesk',
    });
    expect(outbox[0].html).toContain('/app/dashboard');

    const duplicate = await postWithCsrf('/api/auth/register', defaultRegisterPayload);
    expect(duplicate.status).toBe(409);
    expect(getEmailOutbox().filter((email) => email.template === 'welcome')).toHaveLength(1);
  });

  it('sends a hashed reset link without revealing the token in API responses or storage', async () => {
    await registerUser();
    clearEmailOutbox();

    const res = await postWithCsrf('/api/auth/forgot-password', {
      email: defaultRegisterPayload.email,
    });

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('token');

    const outbox = getEmailOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0].template).toBe('password-reset');

    const tokenMatch = /reset-password\?token=([a-f0-9]{64})/.exec(outbox[0].html);
    expect(tokenMatch).not.toBeNull();
    const rawToken = tokenMatch?.[1] as string;

    const stored = await prisma.passwordResetToken.findFirst({
      where: { user: { email: defaultRegisterPayload.email } },
    });
    expect(stored?.tokenHash).toBe(hashToken(rawToken));
    expect(stored?.tokenHash).not.toBe(rawToken);
    expect(outbox[0].text).toContain(rawToken);
  });

  it('returns the same generic response and sends no email for unknown accounts', async () => {
    await registerUser();
    const known = await postWithCsrf('/api/auth/forgot-password', {
      email: defaultRegisterPayload.email,
    });
    expect(known.status).toBe(200);
    clearEmailOutbox();

    const unknown = await postWithCsrf('/api/auth/forgot-password', {
      email: 'nobody@example.com',
    });

    expect(unknown.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
    expect(getEmailOutbox()).toHaveLength(0);
  });

  it('rejects expired reset tokens without changing the password', async () => {
    await registerUser();
    await createResetToken('expired-token-value', new Date(Date.now() - 60_000));

    const res = await postWithCsrf('/api/auth/reset-password', {
      token: 'expired-token-value',
      ...passwordResetPayload,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('RESET_TOKEN_INVALID');

    const login = await postWithCsrf('/api/auth/login', {
      email: defaultRegisterPayload.email,
      password: defaultRegisterPayload.password,
    });
    expect(login.status).toBe(200);
  });

  it('prevents reset-token reuse and sends a reset security notification', async () => {
    await registerUser();
    const userId = await createResetToken('single-use-token', new Date(Date.now() + 30 * 60 * 1000));
    clearEmailOutbox();

    const first = await postWithCsrf('/api/auth/reset-password', {
      token: 'single-use-token',
      ...passwordResetPayload,
    });
    expect(first.status).toBe(200);

    const second = await postWithCsrf('/api/auth/reset-password', {
      token: 'single-use-token',
      ...passwordResetPayload,
    });
    expect(second.status).toBe(400);
    expect(second.body.error.code).toBe('RESET_TOKEN_INVALID');

    const stored = await prisma.passwordResetToken.findFirst({ where: { userId } });
    expect(stored?.usedAt).not.toBeNull();

    const email = getEmailOutbox().find((item) => item.template === 'password-changed');
    expect(email?.subject).toMatch(/password was reset/i);
    expect(email?.text).toMatch(/signed out/i);

    const oldLogin = await postWithCsrf('/api/auth/login', {
      email: defaultRegisterPayload.email,
      password: defaultRegisterPayload.password,
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await postWithCsrf('/api/auth/login', {
      email: defaultRegisterPayload.email,
      password: passwordResetPayload.password,
    });
    expect(newLogin.status).toBe(200);
    expect(getCookie(newLogin, AUTH_COOKIE)).toBeDefined();
  });
});
