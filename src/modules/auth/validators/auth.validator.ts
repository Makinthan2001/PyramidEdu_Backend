import { z } from 'zod';
import { UserRole } from '@prisma/client';

const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be at most 72 characters.')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.');

const emailField = z.string().email('Please provide a valid email address.');

export const registerSchema = z.object({
  email: emailField,
  password: passwordField,
  role: z.nativeEnum(UserRole).refine((role: UserRole) => role !== UserRole.STUDENT, {
    message: 'Role must be ADMIN, MANAGER, or TEACHER.',
  }),
});

export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required.'),
});

export type LoginDto = z.infer<typeof loginSchema>;

export const refreshTokenSchema = z.object({});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: passwordField,
    confirmPassword: z.string().min(1, 'Please confirm your new password.'),
  })
  .refine((value: { newPassword: string; confirmPassword: string }) => value.newPassword === value.confirmPassword, {
    message: 'New password and confirmation do not match.',
    path: ['confirmPassword'],
  })
  .refine((value: { currentPassword: string; newPassword: string }) => value.currentPassword !== value.newPassword, {
    message: 'New password must differ from the current password.',
    path: ['newPassword'],
  });

export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required.'),
    newPassword: passwordField,
    confirmPassword: z.string().min(1, 'Please confirm your new password.'),
  })
  .refine((value: { newPassword: string; confirmPassword: string }) => value.newPassword === value.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;