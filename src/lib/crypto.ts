import { createHash, randomBytes } from 'crypto';

export const generateSecureToken = (): string => randomBytes(32).toString('hex');

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
