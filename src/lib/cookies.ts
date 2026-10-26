import type { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env.ts';
import { getJwtExpiresInSeconds } from './jwt.ts';

/**
 * Shared cookie security attributes.
 * Production deployments may serve the frontend and backend on different
 * sites, so SameSite=None is required for credentialed cross-site requests.
 * Browsers require Secure whenever SameSite=None is used.
 */
export const getCookieSecurityOptions = (): Pick<CookieOptions, 'secure' | 'sameSite'> => ({
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
});

/**
 * Returns every value for a cookie name, in the order sent by the client.
 * Values are kept exactly as transmitted (aside from surrounding whitespace)
 * so CSRF cookie/header comparisons are not affected by URL-decoding.
 * Malformed or empty cookie segments are ignored rather than throwing.
 */
export const getCookieValues = (req: Request, name: string): string[] => {
  const header = req.headers.cookie;
  if (!header) {
    return [];
  }

  const values: string[] = [];
  for (const part of header.split(';')) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = part.slice(0, separatorIndex).trim();
    if (!key || key !== name) {
      continue;
    }

    const value = part.slice(separatorIndex + 1).trim();
    if (value) {
      values.push(value);
    }
  }

  return values;
};

export const getCookieValue = (req: Request, name: string): string | undefined =>
  getCookieValues(req, name)[0];

export const setAuthCookie = (res: Response, token: string): void => {
  res.cookie(env.AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    ...getCookieSecurityOptions(),
    path: '/',
    maxAge: getJwtExpiresInSeconds() * 1000,
  });
};

export const clearAuthCookie = (res: Response): void => {
  res.cookie(env.AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    ...getCookieSecurityOptions(),
    path: '/',
    maxAge: 0,
  });
};
