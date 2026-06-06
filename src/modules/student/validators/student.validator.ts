import { z } from 'zod';

export const initiateRegistrationSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  alExamBatch: z.string().min(1, 'A/L exam batch is required'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  phone: z.string().min(10, 'Phone number must be at least 10 characters'),
  address: z.string().min(1, 'Address is required'),
  
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  nic: z.string().optional(),
  
  parentName: z.string().min(1, 'Parent name is required'),
  parentRelation: z.string().min(1, 'Parent relation is required'),
  parentEmail: z.string().email('Invalid parent email address').optional().or(z.literal('')),
  parentPhone: z.string().min(10, 'Parent phone must be at least 10 characters').optional().or(z.literal('')),
  
  selectedStreamId: z.string().uuid('Invalid stream ID'),
  selectedCourseIds: z.array(z.string().uuid()).min(1, 'Select at least one subject').max(3, 'Select no more than 3 subjects'),
  selectedTeacherIds: z.record(z.string(), z.string().uuid()),
});

export type InitiateRegistrationDto = z.infer<typeof initiateRegistrationSchema>;

export const verifyOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  otpCode: z.string().length(6, 'OTP must be 6 digits'),
});

export type VerifyOtpDto = z.infer<typeof verifyOtpSchema>;

export const resendOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export type ResendOtpDto = z.infer<typeof resendOtpSchema>;
