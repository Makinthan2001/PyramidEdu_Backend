// ============================================================
// src/modules/auth/validators/auth.validator.ts
// Zod schemas that define exactly what shape each request body
// must have. The validate middleware (below) applies these.
// ============================================================

import { z } from 'zod';
import { UserRole } from '@prisma/client';

// ─── Reusable field definitions ───────────────────────────────

// Password must be ≥ 8 chars, contain a number and an uppercase letter.
const passwordField = z
  .string()
  .min(8,  'Password must be at least 8 characters.')
  .max(72,  'Password must be at most 72 characters.')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.');

const emailField = z.string().email('Please provide a valid email address.');

// ─── Register ─────────────────────────────────────────────────
export const registerSchema = z.object({
  email:    emailField,
  password: passwordField,
  role: z.nativeEnum(UserRole, {
    errorMap: () => ({ message: 'Role must be ADMIN, MANAGER, or TEACHER.' }),
  }),
});

export type RegisterDto = z.infer<typeof registerSchema>;

// ─── Login ────────────────────────────────────────────────────
export const loginSchema = z.object({
  email:    emailField,
  password: z.string().min(1, 'Password is required.'),
});

export type LoginDto = z.infer<typeof loginSchema>;

// ─── Refresh token ────────────────────────────────────────────
// The refresh token is read from the httpOnly cookie, not the body.
// This schema just validates the cookie name is present (middleware handles it).
export const refreshTokenSchema = z.object({
  // nothing in body — token comes from cookie
});

// ─── Change password ──────────────────────────────────────────
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword:     passwordField,
    confirmPassword: z.string().min(1, 'Please confirm your new password.'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'New password and confirmation do not match.',
    path:    ['confirmPassword'],
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'New password must differ from the current password.',
    path:    ['newPassword'],
  });

export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;

// ─── Forgot password ──────────────────────────────────────────
export const forgotPasswordSchema = z.object({
  email: emailField,
});

export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;

// ─── Reset password ───────────────────────────────────────────
export const resetPasswordSchema = z
  .object({
    token:           z.string().min(1, 'Reset token is required.'),
    newPassword:     passwordField,
    confirmPassword: z.string().min(1, 'Please confirm your new password.'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match.',
    path:    ['confirmPassword'],
  });

export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
