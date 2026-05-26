import { z } from 'zod';

const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be at most 72 characters.')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.');

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
