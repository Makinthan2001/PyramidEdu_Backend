import { z } from 'zod';

const emailField = z.string().email('Please provide a valid email address.');

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
