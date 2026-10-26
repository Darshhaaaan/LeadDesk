import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from './errors';

export interface AuthJwtPayload extends JwtPayload {
  sub: string;
  email: string;
  tv: number;
}

export const signAuthToken = (userId: string, email: string, tokenVersion: number): string =>
  jwt.sign(
    { sub: userId, email, tv: tokenVersion },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN } as SignOptions
  );

export const verifyAuthToken = (token: string): AuthJwtPayload => {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  const payload = decoded as AuthJwtPayload;

  if (!payload.sub || typeof payload.tv !== 'number') {
    throw new ApiError(401, 'INVALID_TOKEN', 'Invalid authentication token.');
  }

  return payload;
};

/**
 * Converts a JWT expiry string such as "15m" into seconds.
 * Defaults to 900 seconds (15 minutes) when unparsable.
 */
export const getJwtExpiresInSeconds = (): number => {
  const raw = env.JWT_EXPIRES_IN?.trim() ?? '15m';
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(raw);
  if (!match) {
    return 900;
  }
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { ms: 0.001, s: 1, m: 60, h: 3600, d: 86400 };
  const seconds = value * (multipliers[unit] ?? 60);
  return Math.max(1, Math.floor(seconds));
};
