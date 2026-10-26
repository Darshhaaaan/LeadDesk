import type { NextFunction, Request, Response } from 'express';
import { verifyAuthToken } from '../lib/jwt.ts';
import { prisma } from '../lib/prisma.ts';
import { env } from '../config/env.ts';
import { getCookieValue } from '../lib/cookies.ts';
import { ApiError, unauthorized } from '../lib/errors.ts';
import { toSafeUser } from '../lib/user.ts';
import { asyncHandler } from './asyncHandler.ts';

/**
 * Reads the JWT from the auth cookie and verifies it.
 * Attaches the authenticated user's ID to the request context.
 */
export const requireAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const token = getCookieValue(req, env.AUTH_COOKIE_NAME);

  if (!token) {
    next(new ApiError(401, 'UNAUTHENTICATED', 'Authentication required.'));
    return;
  }

  try {
    const payload = verifyAuthToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.tokenVersion !== payload.tv) {
      next(new ApiError(401, 'UNAUTHENTICATED', 'Authentication required.'));
      return;
    }

    req.userId = user.id;
    req.user = toSafeUser(user);

    next();
  } catch {
    next(new ApiError(401, 'INVALID_TOKEN', 'Invalid or expired authentication token.'));
  }
});
