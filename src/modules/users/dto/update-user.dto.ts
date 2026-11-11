import { z } from 'zod';

const emailField = z
  .string()
  .email('Invalid email format')
  .max(255, 'Email must not exceed 255 characters')
  .optional();

const optionalString = z
  .string()
  .max(255)
  .or(z.literal(''))
  .transform((val) => (val === '' ? null : val))
  .nullable()
  .optional();

// Sri Lankan phone validation regex:
// 1) Local 10-digit format: 0XXXXXXXXX (e.g., 07XXXXXXXX)
// 2) International format: +94XXXXXXXXX, 0094XXXXXXXXX, or 94XXXXXXXXX
const sriLankaPhoneRegex = /^(?:0|(?:\+?94|0094))[0-9]{9}$/;

const validateSriLankaPhone = (val: string) => {
  const sanitized = val.replace(/[\s()-]/g, '');
  return sriLankaPhoneRegex.test(sanitized);
};

// Update user DTO - flexible for all role types
export const updateUserSchema = z.object({
  // Common optional fields
  email: emailField,
  phoneNumber: z
    .string()
    .refine((val) => val === '' || validateSriLankaPhone(val), {
      message: 'Invalid Sri Lankan phone number. Use 07X XXX XXXX, 0XXXXXXXXX, or +94/0094/94XXXXXXXXX',
    })
    .or(z.literal(''))
    .transform((val) => (val === '' ? null : (val ? val.replace(/[\s()-]/g, '') : val)))
    .nullable()
    .optional(),
  
  // Name fields
  fullName: z.string().min(1).max(255).optional(),
  firstName: z.string().min(1).max(255).optional(),
  lastName: z.string().min(1).max(255).optional(),
  
  // Identification & Demographic
  nicNumber: z
    .string()
    .max(20)
    .or(z.literal(''))
    .transform((val) => (val === '' ? null : val))
    .nullable()
    .optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  address: z
    .string()
    .max(500)
    .or(z.literal(''))
    .transform((val) => (val === '' ? null : val))
    .nullable()
    .optional(),
  
  // Role-specific fields
  subject: optionalString,
  indexNumber: optionalString,
  parentName: optionalString,
  parentPhone: z
    .string()
    .refine((val) => val === '' || validateSriLankaPhone(val), {
      message: 'Invalid Sri Lankan phone number. Use 07X XXX XXXX, 0XXXXXXXXX, or +94/0094/94XXXXXXXXX',
    })
    .or(z.literal(''))
    .transform((val) => (val === '' ? null : (val ? val.replace(/[\s()-]/g, '') : val)))
    .nullable()
    .optional(),
  parentEmail: z
    .string()
    .email('Invalid email format')
    .or(z.literal(''))
    .transform((val) => (val === '' ? null : val))
    .nullable()
    .optional(),
  parentOccupation: optionalString,
  school: optionalString,
  dateOfBirth: z
    .string()
    .or(z.literal(''))
    .transform((val) => (val === '' ? null : val))
    .nullable()
    .optional(),
  roleType: optionalString,
  
  // Salary
  salary: z.number().positive('Salary must be positive').optional(),
  
  // Profile Image URL
  profileImage: z.string().url('Invalid URL format').or(z.string().min(1)).optional(),
});

export type UpdateUserDto = z.infer<typeof updateUserSchema>;

export default {
  updateUserSchema,
};
