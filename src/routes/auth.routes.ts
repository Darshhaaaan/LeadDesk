import { Router } from 'express';
import { requireAuth } from '../middleware/auth.ts';
import { csrfProtection, ensureCsrfToken } from '../middleware/csrf.ts';
import { asyncHandler } from '../middleware/asyncHandler.ts';
import { loginLimiter, registerLimiter, forgotPasswordLimiter, resetPasswordLimiter, changePasswordLimiter, deleteAccountLimiter } from '../middleware/rateLimit.ts';
import { sendSuccess } from '../lib/response.ts';
import { ApiError } from '../lib/errors.ts';
import { setAuthCookie, clearAuthCookie, getCookieValue } from '../lib/cookies.ts';
import { env } from '../config/env.ts';
import * as authService from '../services/auth.service.ts';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  deleteAccountSchema,
} from '../validation/auth.schemas.ts';

const router = Router();

router.use(csrfProtection);

router.get(
  '/csrf',
  (req, res, next) => {
    const csrfToken = ensureCsrfToken(req, res);
    sendSuccess(res, 200, { csrfToken });
  }
);

const validationError = (error: { issues?: Array<{ message?: string }> }) =>
  new ApiError(400, 'VALIDATION_ERROR', error.issues?.[0]?.message ?? 'Validation failed.');

router.post(
  '/register',
  registerLimiter,
  asyncHandler(async (req, res, next) => {
    const parsed = registerSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      next(validationError(parsed.error));
      return;
    }

    const { name, email, password } = parsed.data;
    const result = await authService.registerUser({ name, email, password });

    setAuthCookie(res, result.token);
    sendSuccess(res, 201, { user: result.user });
  })
);

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res, next) => {
    const parsed = loginSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      next(validationError(parsed.error));
      return;
    }

    const { email, password } = parsed.data;
    const result = await authService.loginUser({ email, password });

    setAuthCookie(res, result.token);
    sendSuccess(res, 200, { user: result.user });
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res, next) => {
    const token = getCookieValue(req, env.AUTH_COOKIE_NAME);
    await authService.logoutUser(token);
    clearAuthCookie(res);
    sendSuccess(res, 200, { message: 'Logged out successfully.' });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res, next) => {
    const userId = req.userId;
    if (!userId) {
      next(new ApiError(401, 'UNAUTHENTICATED', 'Authentication required.'));
      return;
    }

    const user = await authService.getSessionUser(userId);
    sendSuccess(res, 200, { user });
  })
);

router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  asyncHandler(async (req, res, next) => {
    const parsed = forgotPasswordSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      next(validationError(parsed.error));
      return;
    }

    await authService.requestPasswordReset(parsed.data.email);
    sendSuccess(res, 200, { message: 'If an account exists for that email, a password reset link has been sent.' });
  })
);

router.post(
  '/reset-password',
  resetPasswordLimiter,
  asyncHandler(async (req, res, next) => {
    const parsed = resetPasswordSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      next(validationError(parsed.error));
      return;
    }

    await authService.resetPassword({ token: parsed.data.token, password: parsed.data.password });
    sendSuccess(res, 200, { message: 'Password has been reset successfully.' });
  })
);

router.post(
  '/change-password',
  changePasswordLimiter,
  requireAuth,
  asyncHandler(async (req, res, next) => {
    const parsed = changePasswordSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      next(validationError(parsed.error));
      return;
    }

    const userId = req.userId;
    if (!userId) {
      next(new ApiError(401, 'UNAUTHENTICATED', 'Authentication required.'));
      return;
    }

    const { currentPassword, newPassword } = parsed.data;
    await authService.changePassword({ userId, currentPassword, newPassword });
    clearAuthCookie(res);
    sendSuccess(res, 200, { message: 'Password changed successfully. Please sign in again.' });
  })
);

router.delete(
  '/account',
  deleteAccountLimiter,
  requireAuth,
  asyncHandler(async (req, res, next) => {
    const parsed = deleteAccountSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      next(validationError(parsed.error));
      return;
    }

    const userId = req.userId;
    if (!userId) {
      next(new ApiError(401, 'UNAUTHENTICATED', 'Authentication required.'));
      return;
    }

    await authService.deleteAccount({
      userId,
      currentPassword: parsed.data.currentPassword,
    });

    clearAuthCookie(res);
    sendSuccess(res, 200, {
      message: 'Your account and all associated data have been permanently deleted.',
    });
  })
);

export default router;
