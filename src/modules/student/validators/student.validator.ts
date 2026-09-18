import { z } from 'zod';

// Sri Lankan phone validation regex:
// 1) Local 10-digit format: 0XXXXXXXXX (e.g., 07XXXXXXXX)
// 2) International format: +94XXXXXXXXX, 0094XXXXXXXXX, or 94XXXXXXXXX
const sriLankaPhoneRegex = /^(?:0|(?:\+?94|0094))[0-9]{9}$/;

export const validateSriLankaPhone = (val: string) => {
  const sanitized = val.replace(/[\s()-]/g, '');
  return sriLankaPhoneRegex.test(sanitized);
};

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
  phone: z.string().refine(validateSriLankaPhone, {
    message: 'Invalid Sri Lankan phone number. Use 07X XXX XXXX, 0XXXXXXXXX, or +94/0094/94XXXXXXXXX',
  }),
  address: z.string().min(1, 'Address is required'),
  school: z.string().min(1, 'School is required'),
  
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  nic: z.string().optional(),
  
  parentName: z.string().min(1, 'Parent name is required'),
  parentRelation: z.string().min(1, 'Parent relation is required'),
  parentEmail: z.string().email('Invalid parent email address').optional().or(z.literal('')),
  parentPhone: z.string().refine((val) => val === '' || validateSriLankaPhone(val), {
    message: 'Invalid Sri Lankan phone number. Use 07X XXX XXXX, 0XXXXXXXXX, or +94/0094/94XXXXXXXXX',
  }).optional().or(z.literal('')),
  
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
