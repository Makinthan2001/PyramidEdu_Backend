import { z } from 'zod';

// User change-password (self) - must provide current password
export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .max(72, 'Password must not exceed 72 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*()\-_=+\[\]{}|;:,.<>?]/, 'Password must contain at least one special character'),
});

export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;

// Admin reset password - no body required; server will generate a temporary password
export const adminResetPasswordSchema = z.object({});

export type AdminResetPasswordDto = z.infer<typeof adminResetPasswordSchema>;

export default {
  changePasswordSchema,
  adminResetPasswordSchema,
};
