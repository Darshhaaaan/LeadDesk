import type { NextFunction, Request, Response } from 'express';
import { randomBytes, timingSafeEqual } from 'crypto';
import { env } from '../config/env';
import { getCookieSecurityOptions, getCookieValues } from '../lib/cookies';
import { ApiError } from '../lib/errors';
import { sendError } from '../lib/response';

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// Registration is intentionally exempt so new users can create an account
// before they have a session/CSRF cookie. All other unsafe routes remain
// protected by csrfProtection.
const CSRF_EXEMPT_ENDPOINTS = new Set(['POST /api/auth/register']);

const getEndpointKey = (req: Request): string => {
  const path = `${req.baseUrl}${req.path}`.replace(/\/+$/, '') || '/';
  return `${req.method.toUpperCase()} ${path.toLowerCase()}`;
};

const tokensMatch = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
};

/**
 * Logs only presence, lengths, and equality flags. Never log cookie/header
 * values, passwords, or authentication cookies.
 */
const logCsrfFailure = (
  req: Request,
  hasCookieHeader: boolean,
  cookieTokenLengths: number[],
  headerTokenLength: number,
  tokensMatch: boolean
): void => {
  if (env.NODE_ENV === 'test') {
    return;
  }

  console.warn('[csrf] validation failed', {
    method: req.method,
    path: req.originalUrl,
    hasCookieHeader,
    hasCsrfCookie: cookieTokenLengths.length > 0,
    hasCsrfHeader: headerTokenLength > 0,
    cookieTokenLengths,
    headerTokenLength,
    tokensMatch,
  });
};

export const ensureCsrfToken = (req: Request, res: Response): string => {
  // Reuse a token already issued during this request (for example, the token
  // created by csrfProtection before the /csrf handler runs) so the cookie and
  // the response body always contain the same value.
  const localToken = res.locals.csrfToken;
  const cookieTokens = getCookieValues(req, env.CSRF_COOKIE_NAME);
  const existingToken =
    cookieTokens[cookieTokens.length - 1] ?? (typeof localToken === 'string' ? localToken : undefined);
  if (existingToken) {
    return existingToken;
  }

  const csrfToken = randomBytes(32).toString('hex');
  res.locals.csrfToken = csrfToken;
  res.cookie(env.CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    ...getCookieSecurityOptions(),
    path: '/',
    maxAge: 60 * 60 * 1000,
  });

  return csrfToken;
};

/**
 * Double-submit CSRF protection for state-changing requests.
 * Issues a CSRF token cookie on safe methods and validates the
 * X-XSRF-TOKEN header against the cookie for unsafe methods.
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  if (CSRF_EXEMPT_ENDPOINTS.has(getEndpointKey(req))) {
    next();
    return;
  }

  if (SAFE_METHODS.includes(req.method)) {
    ensureCsrfToken(req, res);
    next();
    return;
  }

  const cookieTokens = getCookieValues(req, env.CSRF_COOKIE_NAME);
  const headerToken = req.headers['x-xsrf-token'];
  const headerValue = Array.isArray(headerToken) ? headerToken[0] : headerToken;
  const headerTokenString = typeof headerValue === 'string' ? headerValue.trim() : '';

  const tokensAreValid =
    Boolean(headerTokenString) &&
    cookieTokens.some((cookieToken) => tokensMatch(cookieToken, headerTokenString));

  if (!tokensAreValid) {
    logCsrfFailure(
      req,
      Boolean(req.headers.cookie),
      cookieTokens.map((cookieToken) => cookieToken.length),
      headerTokenString.length,
      tokensAreValid
    );
    sendError(res, new ApiError(403, 'CSRF_ERROR', 'CSRF validation failed.'));
    return;
  }

  next();
};
