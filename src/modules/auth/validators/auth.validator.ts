import { z } from 'zod';
import { UserRole } from '@prisma/client';
// Import DTOs
export { LoginDto, loginSchema } from '../dto/login.dto';
export { ForgotPasswordDto, forgotPasswordSchema } from '../dto/forgot-password.dto';
export { ResetPasswordDto, resetPasswordSchema } from '../dto/reset-password.dto';
export { ChangePasswordDto, changePasswordSchema } from '../dto/change-password.dto';

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

export const refreshTokenSchema = z.object({});