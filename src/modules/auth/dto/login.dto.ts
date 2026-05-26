import { z } from 'zod';

const emailField = z.string().email('Please provide a valid email address.');

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required.'),
});

export type LoginDto = z.infer<typeof loginSchema>;
