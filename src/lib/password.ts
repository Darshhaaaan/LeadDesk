import bcrypt from 'bcryptjs';

export const BCRYPT_SALT_ROUNDS = 12;

export const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

export const verifyPassword = (password: string, hash: string): Promise<boolean> =>
  bcrypt.compare(password, hash);
