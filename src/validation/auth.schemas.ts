import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long.')
  .max(72, 'Password must be at most 72 characters long.')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, 'Password must contain an uppercase letter, a lowercase letter, and a number.');

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters long.')
  .max(120, 'Name must be at most 120 characters long.');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Please provide a valid email address.')
  .max(320, 'Email must be at most 320 characters long.');

export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required.'),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1, 'Reset token is required.').max(128, 'Reset token is invalid.'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your new password.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New password and confirmation do not match.',
    path: ['confirmPassword'],
  });

export const deleteAccountSchema = z.object({
  currentPassword: z
    .string()
    .min(1, 'Current password is required to delete your account.')
    .max(72, 'Current password is invalid.'),
});

