import { z } from 'zod';
import { config } from 'dotenv';

config({ quiet: true });

const optionalString = z.preprocess((value) => {
  if (value === undefined) {
    return undefined;
  }
  const str = String(value).trim();
  return str === '' ? undefined : str;
}, z.string().optional());

const optionalEmail = z.preprocess((value) => {
  const str = value === undefined ? '' : String(value).trim();
  return str === '' ? undefined : str;
}, z.string().email().optional());

const optionalBoolean = z.preprocess((value) => {
  if (value === undefined || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no'].includes(normalized)) {
    return false;
  }
  return value;
}, z.boolean().optional());

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required.'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be a string of at least 32 characters.'),
    JWT_EXPIRES_IN: z.string().default('15m'),
    FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL.'),
    BACKEND_URL: z.string().url('BACKEND_URL must be a valid URL.'),
    AUTH_COOKIE_NAME: z.string().default('auth_token'),
    CSRF_COOKIE_NAME: z.string().default('csrf_token'),

    // Branding and support contact used by transactional emails.
    APP_NAME: z.string().trim().min(1).max(60).default('LeadDesk'),
    SUPPORT_EMAIL: optionalEmail,

    // SMTP is optional in development/test (emails are captured in-memory),
    // but must be complete whenever any SMTP setting is supplied.
    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: optionalBoolean,
    SMTP_USER: optionalString,
    SMTP_PASS: optionalString,
    SMTP_FROM: optionalEmail,
    SMTP_REPLY_TO: optionalEmail,
  })
  .superRefine((data, ctx) => {
    const smtpValues = [data.SMTP_HOST, data.SMTP_USER, data.SMTP_PASS, data.SMTP_FROM];
    const provided = smtpValues.filter(Boolean).length;

    if (provided > 0 && provided < smtpValues.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['SMTP_HOST'],
        message:
          'SMTP configuration is incomplete. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM together.',
      });
    }

    if (data.NODE_ENV === 'production' && !data.SUPPORT_EMAIL) {
      ctx.addIssue({
        code: 'custom',
        path: ['SUPPORT_EMAIL'],
        message: 'SUPPORT_EMAIL is required in production so emails include a real support contact.',
      });
    }
  });

export const env = envSchema.parse(process.env);

if (env.NODE_ENV === 'production') {
  const missing = [
    ['DATABASE_URL', env.DATABASE_URL],
    ['JWT_SECRET', env.JWT_SECRET],
    ['FRONTEND_URL', env.FRONTEND_URL],
    ['BACKEND_URL', env.BACKEND_URL],
    ['APP_NAME', env.APP_NAME],
    ['SUPPORT_EMAIL', env.SUPPORT_EMAIL],
    ['SMTP_HOST', env.SMTP_HOST],
    ['SMTP_USER', env.SMTP_USER],
    ['SMTP_PASS', env.SMTP_PASS],
    ['SMTP_FROM', env.SMTP_FROM],
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for production: ${missing.map(([key]) => key).join(', ')}. ` +
        'Copy .env.example to .env and fill in all required values before starting the server.'
    );
  }
}
