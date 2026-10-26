import nodemailer from 'nodemailer';
import type { SendMailOptions, Transporter } from 'nodemailer';
import { env } from '../config/env.ts';
import { renderWelcomeEmail } from '../emails/templates/welcome.ts';
import { renderPasswordResetEmail } from '../emails/templates/password-reset.ts';
import { renderPasswordChangedEmail } from '../emails/templates/password-changed.ts';
import { renderAccountDeletedEmail } from '../emails/templates/account-deleted.ts';
import type { EmailBrand, RenderedEmail } from '../emails/types.ts';

export type EmailTemplateName = 'welcome' | 'password-reset' | 'password-changed' | 'account-deleted';

export type EmailDeliveryReason = 'delivered' | 'not_configured' | 'delivery_failed';

export interface EmailDeliveryResult {
  delivered: boolean;
  reason: EmailDeliveryReason;
}

export interface OutboxEmail {
  to: string;
  template: EmailTemplateName;
  subject: string;
  html: string;
  text: string;
  createdAt: string;
}

const outbox: OutboxEmail[] = [];
let cachedTransporter: Transporter | null = null;
let testTransportOverride: Transporter | null | undefined;

const MINUTE_MS = 60 * 1000;
export const PASSWORD_RESET_TTL_MINUTES = 30;
export const PASSWORD_RESET_TTL_MS = PASSWORD_RESET_TTL_MINUTES * MINUTE_MS;

const isSmtpConfigured = (): boolean =>
  Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM);

/**
 * All links in emails are derived from the validated FRONTEND_URL setting.
 * Request headers are never used, which prevents host-header injection.
 */
export const buildFrontendUrl = (path: string): string => {
  const base = new URL(env.FRONTEND_URL);

  if (base.protocol !== 'http:' && base.protocol !== 'https:') {
    throw new Error('FRONTEND_URL must use http or https.');
  }

  if (base.username || base.password) {
    throw new Error('FRONTEND_URL must not contain credentials.');
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, base).toString();
};

const getBrand = (): EmailBrand => ({
  appName: env.APP_NAME,
  supportEmail: env.SUPPORT_EMAIL,
  frontendUrl: env.FRONTEND_URL,
});

const getEmailTransporter = (): Transporter | null => {
  if (env.NODE_ENV === 'test') {
    // Tests either inject a fake transport or use the in-memory outbox.
    // They must never open a real SMTP connection.
    return testTransportOverride ?? null;
  }

  if (testTransportOverride !== undefined) {
    return testTransportOverride;
  }

  if (cachedTransporter) {
    return cachedTransporter;
  }

  if (!isSmtpConfigured()) {
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE ?? env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  return cachedTransporter;
};

interface LoggedEmailError {
  name: string;
  message: string;
  stack?: string;
  code?: string | number;
  errno?: string | number;
  syscall?: string;
  hostname?: string;
  address?: string;
  port?: number;
  responseCode?: number | string;
  response?: string;
  cause?: LoggedEmailError;
}

const EMAIL_ADDRESS_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const RESET_TOKEN_PATTERN = /([?&]token=)[^&\s]+/gi;
const MAX_ERROR_CAUSE_DEPTH = 3;

const redactSensitiveText = (value: string): string => {
  let redacted = value.replace(EMAIL_ADDRESS_PATTERN, '[redacted-email]');
  redacted = redacted.replace(RESET_TOKEN_PATTERN, '$1[redacted]');

  if (env.SMTP_PASS) {
    redacted = redacted.split(env.SMTP_PASS).join('[redacted]');
  }

  return redacted;
};

/**
 * Converts SMTP and template errors into a log-safe object. Deployment logs
 * need the real message and stack, but must never contain recipients, reset
 * tokens, or SMTP credentials.
 */
export const formatEmailErrorForLog = (error: unknown, depth = 0): LoggedEmailError => {
  if (!(error instanceof Error)) {
    return {
      name: 'UnknownError',
      message: redactSensitiveText(String(error)),
    };
  }

  const details: LoggedEmailError = {
    name: error.name,
    message: redactSensitiveText(error.message || '(no error message)'),
  };

  if (error.stack) {
    details.stack = redactSensitiveText(error.stack);
  }

  const transportError = error as Error & {
    code?: unknown;
    errno?: unknown;
    syscall?: unknown;
    hostname?: unknown;
    address?: unknown;
    port?: unknown;
    responseCode?: unknown;
    response?: unknown;
    cause?: unknown;
  };

  if (typeof transportError.code === 'string' || typeof transportError.code === 'number') {
    details.code = transportError.code;
  }
  if (typeof transportError.errno === 'string' || typeof transportError.errno === 'number') {
    details.errno = transportError.errno;
  }
  if (typeof transportError.syscall === 'string') {
    details.syscall = transportError.syscall;
  }
  if (typeof transportError.hostname === 'string') {
    details.hostname = transportError.hostname;
  }
  if (typeof transportError.address === 'string') {
    details.address = transportError.address;
  }
  if (typeof transportError.port === 'number') {
    details.port = transportError.port;
  }
  if (typeof transportError.responseCode === 'number' || typeof transportError.responseCode === 'string') {
    details.responseCode = transportError.responseCode;
  }
  if (typeof transportError.response === 'string') {
    details.response = redactSensitiveText(transportError.response);
  }
  if (depth < MAX_ERROR_CAUSE_DEPTH && transportError.cause instanceof Error) {
    details.cause = formatEmailErrorForLog(transportError.cause, depth + 1);
  }

  return details;
};

const logDeliveryFailure = (template: EmailTemplateName, error: unknown): void => {
  if (env.NODE_ENV === 'test') {
    return;
  }

  console.error('[email] delivery failed', {
    template,
    ...formatEmailErrorForLog(error),
  });
};

const captureInOutbox = (
  to: string,
  template: EmailTemplateName,
  email: RenderedEmail
): void => {
  // The outbox is a development/test inspection aid. Production keeps no
  // message copies, so reset tokens cannot linger in process memory.
  if (env.NODE_ENV === 'production') {
    return;
  }

  outbox.push({
    to,
    template,
    subject: email.subject,
    html: email.html,
    text: email.text,
    createdAt: new Date().toISOString(),
  });
};

const deliver = async (
  to: string,
  template: EmailTemplateName,
  email: RenderedEmail
): Promise<EmailDeliveryResult> => {
  const transporter = getEmailTransporter();

  if (!transporter) {
    if (env.NODE_ENV === 'production') {
      logDeliveryFailure(template, new Error('Email transport is not configured.'));
      return { delivered: false, reason: 'not_configured' };
    }

    // Safe development/test fallback: keep the message in memory so it can be
    // inspected without delivering real email or weakening production checks.
    captureInOutbox(to, template, email);

    if (env.NODE_ENV === 'development') {
      console.info(`[email] SMTP is not configured; captured "${template}" email in the development outbox.`);
    }

    return { delivered: false, reason: 'not_configured' };
  }

  const smtpFrom = env.SMTP_FROM ?? 'no-reply@localhost';
  const options: SendMailOptions = {
    from: `${env.APP_NAME} <${smtpFrom}>`,
    to,
    subject: email.subject,
    text: email.text,
    html: email.html,
    replyTo: env.SMTP_REPLY_TO ?? env.SUPPORT_EMAIL,
    headers: {
      'X-Auto-Response-Suppress': 'OOF, AutoReply',
    },
  };

  try {
    await transporter.sendMail(options);

    captureInOutbox(to, template, email);

    return { delivered: true, reason: 'delivered' };
  } catch (error) {
    logDeliveryFailure(template, error);
    return { delivered: false, reason: 'delivery_failed' };
  }
};

const sendRendered = async (
  to: string,
  template: EmailTemplateName,
  render: () => RenderedEmail
): Promise<EmailDeliveryResult> => {
  try {
    return await deliver(to, template, render());
  } catch (error) {
    logDeliveryFailure(template, error);
    return { delivered: false, reason: 'delivery_failed' };
  }
};

export const sendWelcomeEmail = async (input: {
  to: string;
  name: string;
}): Promise<EmailDeliveryResult> =>
  sendRendered(input.to, 'welcome', () =>
    renderWelcomeEmail({
      brand: getBrand(),
      name: input.name,
      dashboardUrl: buildFrontendUrl('/app/dashboard'),
    })
  );

export const sendPasswordResetEmail = async (input: {
  to: string;
  name: string;
  resetToken: string;
}): Promise<EmailDeliveryResult> =>
  sendRendered(input.to, 'password-reset', () =>
    renderPasswordResetEmail({
      brand: getBrand(),
      name: input.name,
      resetUrl: buildFrontendUrl(`/reset-password?token=${encodeURIComponent(input.resetToken)}`),
      expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
    })
  );

export const sendPasswordChangedEmail = async (input: {
  to: string;
  name: string;
  wasReset?: boolean;
}): Promise<EmailDeliveryResult> =>
  sendRendered(input.to, 'password-changed', () =>
    renderPasswordChangedEmail({
      brand: getBrand(),
      name: input.name,
      changedAt: new Date(),
      securityUrl: buildFrontendUrl('/app/settings'),
      wasReset: input.wasReset,
    })
  );

export const sendAccountDeletedEmail = async (input: {
  to: string;
}): Promise<EmailDeliveryResult> =>
  sendRendered(input.to, 'account-deleted', () =>
    renderAccountDeletedEmail({
      brand: getBrand(),
      deletedAt: new Date(),
      registerUrl: buildFrontendUrl('/register'),
    })
  );

/**
 * Logs the active email mode without exposing SMTP credentials. Production
 * configuration completeness is validated by config/env.ts at startup.
 */
export const validateEmailConfiguration = (): { configured: boolean } => {
  const configured = isSmtpConfigured();

  if (env.NODE_ENV === 'production' && !configured) {
    throw new Error('SMTP must be configured in production.');
  }

  if (env.NODE_ENV === 'development') {
    console.info(
      configured
        ? '[email] SMTP configured; transactional email will be delivered.'
        : '[email] SMTP not configured; transactional email will be captured in the development outbox.'
    );
  }

  return { configured };
};

/** Test helpers. These are hard-blocked outside NODE_ENV=test. */
export const setEmailTransportForTests = (transporter: Transporter | null): void => {
  if (env.NODE_ENV !== 'test') {
    throw new Error('setEmailTransportForTests may only be used in tests.');
  }
  testTransportOverride = transporter;
  cachedTransporter = null;
};

export const resetEmailServiceForTests = (): void => {
  if (env.NODE_ENV !== 'test') {
    throw new Error('resetEmailServiceForTests may only be used in tests.');
  }
  testTransportOverride = undefined;
  cachedTransporter = null;
  outbox.length = 0;
};

export const getEmailOutbox = (): OutboxEmail[] => [...outbox];

export const clearEmailOutbox = (): void => {
  outbox.length = 0;
};
