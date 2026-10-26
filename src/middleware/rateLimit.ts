import rateLimit from 'express-rate-limit';
import { ApiError, tooManyRequests } from '../lib/errors';
import { sendError } from '../lib/response';

const createLimiter = (windowMs: number, limit: number, message: string) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      sendError(res, tooManyRequests(message));
    },
  });

export const registerLimiter = createLimiter(
  15 * 60 * 1000,
  5,
  'Too many registration attempts. Please try again later.'
);

export const loginLimiter = createLimiter(
  15 * 60 * 1000,
  10,
  'Too many login attempts. Please try again later.'
);

export const forgotPasswordLimiter = createLimiter(
  60 * 60 * 1000,
  3,
  'Too many password reset requests. Please try again later.'
);

export const resetPasswordLimiter = createLimiter(
  60 * 60 * 1000,
  10,
  'Too many password reset attempts. Please try again later.'
);

export const changePasswordLimiter = createLimiter(
  60 * 60 * 1000,
  10,
  'Too many password change attempts. Please try again later.'
);

export const deleteAccountLimiter = createLimiter(
  60 * 60 * 1000,
  5,
  'Too many account deletion attempts. Please try again later.'
);

export const leadWriteLimiter = createLimiter(
  15 * 60 * 1000,
  120,
  'Too many lead changes. Please try again later.'
);

