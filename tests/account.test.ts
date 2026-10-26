import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Transporter } from 'nodemailer';
import { prisma } from '../src/lib/prisma';
import { hashToken } from '../src/lib/crypto';
import {
  clearEmailOutbox,
  getEmailOutbox,
  resetEmailServiceForTests,
  setEmailTransportForTests,
} from '../src/services/email.service';
import {
  AUTH_COOKIE,
  deleteWithCsrf,
  getCookie,
  getCsrf,
  getSetCookie,
  getWithCookies,
  joinCookies,
  postWithCsrf,
  registerUser,
  resetRateLimits,
  sendWithCsrf,
} from './helpers';
import request from 'supertest';
import { app } from './helpers';

const registerPayload = {
  name: 'Delete Me',
  email: 'delete.me@example.com',
  password: 'Password1',
  confirmPassword: 'Password1',
};

const createOwnedData = async (userId: string) => {
  const lead = await prisma.lead.create({
    data: {
      userId,
      name: 'Owned Lead',
      email: 'owned@example.com',
      status: 'Qualified',
    },
  });
  const activity = await prisma.leadActivity.create({
    data: {
      leadId: lead.id,
      userId,
      type: 'Created',
      description: 'Lead created.',
    },
  });
  const reset = await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken('owned-reset-token'),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
  return { lead, activity, reset };
};

describe('Account lifecycle', () => {
  let authCookie: string;
  let userId: string;

  beforeEach(async () => {
    await resetRateLimits();
    resetEmailServiceForTests();
    await prisma.user.deleteMany({});

    const registered = await registerUser(registerPayload);
    authCookie = getCookie(registered, AUTH_COOKIE) as string;
    userId = registered.body.data.user.id;
    clearEmailOutbox();
  });

  describe('DELETE /api/auth/account', () => {
    it('rejects an incorrect current password without deleting anything', async () => {
      const owned = await createOwnedData(userId);
      const res = await deleteWithCsrf('/api/auth/account', { currentPassword: 'WrongPassword1' }, [
        authCookie,
      ]);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(await prisma.user.findUnique({ where: { id: userId } })).not.toBeNull();
      expect(await prisma.lead.findUnique({ where: { id: owned.lead.id } })).not.toBeNull();
      expect(await prisma.leadActivity.findUnique({ where: { id: owned.activity.id } })).not.toBeNull();
      expect(await prisma.passwordResetToken.findUnique({ where: { id: owned.reset.id } })).not.toBeNull();
      expect(getEmailOutbox().filter((email) => email.template === 'account-deleted')).toHaveLength(0);
    });

    it('permanently deletes the user and all owned records, then clears the auth cookie', async () => {
      const owned = await createOwnedData(userId);
      const res = await deleteWithCsrf('/api/auth/account', { currentPassword: 'Password1' }, [
        authCookie,
      ]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toMatch(/permanently deleted/i);
      expect(getSetCookie(res, AUTH_COOKIE)).toMatch(/auth_token=;/);
      expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
      expect(await prisma.lead.findUnique({ where: { id: owned.lead.id } })).toBeNull();
      expect(await prisma.leadActivity.findUnique({ where: { id: owned.activity.id } })).toBeNull();
      expect(await prisma.passwordResetToken.findUnique({ where: { id: owned.reset.id } })).toBeNull();

      const deletionEmail = getEmailOutbox().find((email) => email.template === 'account-deleted');
      expect(deletionEmail?.to).toBe(registerPayload.email);
      expect(deletionEmail?.text).toMatch(/permanently deleted/i);
      expect(deletionEmail?.text).not.toContain('Password1');
    });

    it('invalidates existing tokens immediately after deletion', async () => {
      const res = await deleteWithCsrf('/api/auth/account', { currentPassword: 'Password1' }, [
        authCookie,
      ]);
      expect(res.status).toBe(200);

      const me = await getWithCookies('/api/auth/me', [authCookie]);
      expect(me.status).toBe(401);

      const login = await postWithCsrf('/api/auth/login', {
        email: registerPayload.email,
        password: registerPayload.password,
      });
      expect(login.status).toBe(401);
    });

    it('requires a CSRF token', async () => {
      const csrf = await getCsrf();
      const res = await request(app)
        .delete('/api/auth/account')
        .set('Cookie', joinCookies(authCookie, csrf.cookie))
        .send({ currentPassword: 'Password1' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CSRF_ERROR');
      expect(await prisma.user.findUnique({ where: { id: userId } })).not.toBeNull();
    });

    it('requires authentication', async () => {
      const res = await sendWithCsrf('delete', '/api/auth/account', { currentPassword: 'Password1' });
      expect(res.status).toBe(401);
      expect(await prisma.user.findUnique({ where: { id: userId } })).not.toBeNull();
    });

    it('validates the current password field', async () => {
      const res = await deleteWithCsrf('/api/auth/account', { currentPassword: '' }, [authCookie]);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(await prisma.user.findUnique({ where: { id: userId } })).not.toBeNull();
    });

    it('relies on database cascades when a user is deleted directly', async () => {
      const owned = await createOwnedData(userId);
      const secondUser = await prisma.user.create({
        data: {
          name: 'Second User',
          email: 'second@example.com',
          passwordHash: 'not-used',
        },
      });
      const secondLead = await prisma.lead.create({
        data: { userId: secondUser.id, name: 'Second Lead', email: 'second@example.com' },
      });
      await prisma.leadActivity.create({
        data: {
          leadId: secondLead.id,
          userId: secondUser.id,
          type: 'Created',
          description: 'Lead created.',
        },
      });
      await prisma.passwordResetToken.create({
        data: {
          userId: secondUser.id,
          tokenHash: hashToken('second-token'),
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      await prisma.user.delete({ where: { id: userId } });

      expect(await prisma.lead.count({ where: { userId } })).toBe(0);
      expect(await prisma.leadActivity.count({ where: { userId } })).toBe(0);
      expect(await prisma.passwordResetToken.count({ where: { userId } })).toBe(0);
      expect(await prisma.lead.findUnique({ where: { id: owned.lead.id } })).toBeNull();

      // Other users' data is untouched.
      expect(await prisma.lead.count({ where: { userId: secondUser.id } })).toBe(1);
    });
  });

  describe('security notification emails', () => {
    it('sends a password-changed email only after the password update succeeds', async () => {
      const res = await postWithCsrf(
        '/api/auth/change-password',
        {
          currentPassword: 'Password1',
          newPassword: 'NewPassword2',
          confirmPassword: 'NewPassword2',
        },
        [authCookie]
      );

      expect(res.status).toBe(200);
      const email = getEmailOutbox().find((item) => item.template === 'password-changed');
      expect(email?.to).toBe(registerPayload.email);
      expect(email?.subject).toMatch(/password was changed/i);
      expect(email?.text).toMatch(/did not make this change/i);

      const me = await getWithCookies('/api/auth/me', [authCookie]);
      expect(me.status).toBe(401);
    });

    it('does not send a password-changed email when the current password is wrong', async () => {
      const res = await postWithCsrf(
        '/api/auth/change-password',
        {
          currentPassword: 'WrongPassword1',
          newPassword: 'NewPassword2',
          confirmPassword: 'NewPassword2',
        },
        [authCookie]
      );

      expect(res.status).toBe(401);
      expect(getEmailOutbox().filter((item) => item.template === 'password-changed')).toHaveLength(0);
    });

    it('still completes registration when email delivery fails', async () => {
      const sendMail = vi.fn().mockRejectedValue(new Error('SMTP unavailable'));
      setEmailTransportForTests({ sendMail } as unknown as Transporter);

      const res = await postWithCsrf('/api/auth/register', {
        name: 'No Email User',
        email: 'no-email@example.com',
        password: 'Password1',
        confirmPassword: 'Password1',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(await prisma.user.findUnique({ where: { email: 'no-email@example.com' } })).not.toBeNull();
      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(getEmailOutbox().filter((item) => item.template === 'welcome')).toHaveLength(0);
    });

    it('still completes password reset when email delivery fails', async () => {
      const owned = await createOwnedData(userId);
      expect(owned.reset).toBeTruthy();
      const sendMail = vi.fn().mockRejectedValue(new Error('SMTP unavailable'));
      setEmailTransportForTests({ sendMail } as unknown as Transporter);

      const res = await postWithCsrf('/api/auth/forgot-password', { email: registerPayload.email });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toMatch(/if an account exists/i);
      expect(JSON.stringify(res.body)).not.toMatch(/token/i);
      expect(await prisma.passwordResetToken.count({ where: { userId } })).toBe(1);
    });
  });
});
