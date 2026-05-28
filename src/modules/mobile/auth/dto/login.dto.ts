import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please provide a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

export type LoginDto = z.infer<typeof loginSchema>;