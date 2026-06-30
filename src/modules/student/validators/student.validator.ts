import { z } from 'zod';

export const initiateRegistrationSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required').refine((dob) => {
    const date = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
      age--;
    }
    return age >= 16;
  }, 'Student must be at least 16 years old'),
  alExamBatch: z.string().min(1, 'A/L exam batch is required'),
  batchId: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  phone: z.string().regex(/^\d{10}$/, 'Phone number must be exactly 10 digits'),
  address: z.string().min(1, 'Address is required'),
  school: z.string().min(1, 'School is required'),
  
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  nic: z.string().optional(),
  
  parentName: z.string().min(1, 'Parent name is required'),
  parentRelation: z.string().min(1, 'Parent relation is required'),
  parentEmail: z.string().email('Invalid parent email address').optional().or(z.literal('')),
  parentPhone: z.string().regex(/^\d{10}$/, 'Parent phone number must be exactly 10 digits').optional().or(z.literal('')),
  
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
