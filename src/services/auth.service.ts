import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword } from '../lib/password';
import { signAuthToken, verifyAuthToken } from '../lib/jwt';
import { generateSecureToken, hashToken } from '../lib/crypto';
import { toSafeUser, type SafeUser } from '../lib/user';
import { ApiError } from '../lib/errors';
import {
  PASSWORD_RESET_TTL_MS,
  sendAccountDeletedEmail,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from './email.service';

const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 8 characters and at most 72 characters and must contain an uppercase letter, a lowercase letter, and a number.';

const PASSWORD_POLICY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

export const assertStrongPassword = (password: string): void => {
  const isValid =
    password.length >= 8 &&
    password.length <= 72 &&
    PASSWORD_POLICY_REGEX.test(password);

  if (!isValid) {
    throw new ApiError(400, 'PASSWORD_TOO_WEAK', PASSWORD_POLICY_MESSAGE);
  }
};

export interface AuthResult {
  user: SafeUser;
  token: string;
}

export const registerUser = async (input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResult> => {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existingUser) {
    throw new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists.');
  }

  const passwordHash = await hashPassword(input.password);

  let user;
  try {
    user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        tokenVersion: 0,
      },
    });
  } catch (error) {
    // Handles a concurrent registration race without leaking database details.
    if ((error as { code?: string }).code === 'P2002') {
      throw new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists.');
    }
    throw error;
  }

  const token = signAuthToken(user.id, user.email, user.tokenVersion);

  // The account exists before this runs. A delivery failure must not roll back
  // registration or reveal internal information to the client.
  await sendWelcomeEmail({ to: user.email, name: user.name });

  return { user: toSafeUser(user), token };
};

export const loginUser = async (input: { email: string; password: string }): Promise<AuthResult> => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  const isPasswordValid = user ? await verifyPassword(input.password, user.passwordHash) : false;

  if (!user || !isPasswordValid) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const token = signAuthToken(user.id, user.email, user.tokenVersion);

  return { user: toSafeUser(user), token };
};

export const getSessionUser = async (userId: string): Promise<SafeUser> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required.');
  }

  return toSafeUser(user);
};

export const logoutUser = async (token: string | undefined): Promise<void> => {
  if (!token) {
    return;
  }

  try {
    const payload = verifyAuthToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { tokenVersion: { increment: 1 } },
      });
    }
  } catch {
    // Invalid or expired tokens simply cannot access protected routes.
  }
};

export const requestPasswordReset = async (email: string): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  // Always return the same generic response, whether or not the account exists.
  if (!user) {
    return;
  }

  // Invalidate any outstanding reset tokens for this user before issuing a new one.
  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    },
  });

  // The raw token is only embedded in the email link. It is never stored or
  // returned by the API, and delivery failures are handled inside the service.
  await sendPasswordResetEmail({ to: user.email, name: user.name, resetToken: rawToken });
};

export const resetPassword = async (input: {
  token: string;
  password: string;
}): Promise<void> => {
  const tokenHash = hashToken(input.token);
  const now = new Date();

  const completedRecipient = await prisma.$transaction(async (tx) => {
    const tokenRecord = await tx.passwordResetToken.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: now },
        usedAt: null,
      },
    });

    if (!tokenRecord) {
      throw new ApiError(400, 'RESET_TOKEN_INVALID', 'Password reset token is invalid or has expired.');
    }

    const user = await tx.user.findUnique({
      where: { id: tokenRecord.userId },
    });

    if (!user) {
      throw new ApiError(400, 'RESET_TOKEN_INVALID', 'Password reset token is invalid or has expired.');
    }

    await tx.passwordResetToken.update({
      where: { id: tokenRecord.id },
      data: { usedAt: new Date() },
    });

    // Invalidate any other outstanding reset tokens for this user.
    await tx.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    const passwordHash = await hashPassword(input.password);

    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
      },
    });

    return { email: user.email, name: user.name };
  });

  if (completedRecipient) {
    await sendPasswordChangedEmail({
      to: completedRecipient.email,
      name: completedRecipient.name,
      wasReset: true,
    });
  }
};

export const changePassword = async (input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<SafeUser> => {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
  });

  if (!user) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required.');
  }

  const isCurrentPasswordValid = await verifyPassword(input.currentPassword, user.passwordHash);

  if (!isCurrentPasswordValid) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const isSamePassword = await verifyPassword(input.newPassword, user.passwordHash);

  if (isSamePassword) {
    throw new ApiError(400, 'PASSWORD_SAME_AS_CURRENT', 'New password must be different from the current password.');
  }

  assertStrongPassword(input.newPassword);

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(input.newPassword),
      tokenVersion: { increment: 1 },
    },
  });

  // The database update has already succeeded. Email failures are logged
  // safely inside the email service and never change the API outcome.
  await sendPasswordChangedEmail({ to: user.email, name: user.name });

  return toSafeUser(updatedUser);
};

/**
 * Permanently deletes the authenticated user and all user-owned records.
 *
 * The User, Lead, LeadActivity, and PasswordResetToken foreign keys all use
 * ON DELETE CASCADE. Dependent rows are also removed explicitly inside the
 * same transaction so the retention behavior remains obvious and testable.
 */
export const deleteAccount = async (input: {
  userId: string;
  currentPassword: string;
}): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
  });

  if (!user) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required.');
  }

  const isPasswordValid = await verifyPassword(input.currentPassword, user.passwordHash);

  if (!isPasswordValid) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.leadActivity.deleteMany({ where: { userId: user.id } });
    await tx.lead.deleteMany({ where: { userId: user.id } });
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });

    // Deleting the user is the final step; every JWT for this user becomes
    // unusable because requireAuth can no longer find the account.
    await tx.user.delete({ where: { id: user.id } });
  });

  await sendAccountDeletedEmail({ to: user.email });
};
