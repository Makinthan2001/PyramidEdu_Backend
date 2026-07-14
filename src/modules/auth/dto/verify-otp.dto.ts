import { z } from 'zod';

export const verifyOtpSchema = z.object({
  email: z.string().email('Please provide a valid email address.'),
  otp: z.string().length(6, 'OTP must be exactly 6 digits.'),
  verificationToken: z.string().min(1, 'Verification token is required.'),
});

export type VerifyOtpDto = z.infer<typeof verifyOtpSchema>;
