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

// Update user DTO - flexible for all role types
export const updateUserSchema = z.object({
  // Common optional fields
  email: emailField,
  phoneNumber: z
    .string()
    .min(10, 'Phone number must be at least 10 digits')
    .or(z.literal(''))
    .transform((val) => (val === '' ? null : val))
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
    .min(10)
    .or(z.literal(''))
    .transform((val) => (val === '' ? null : val))
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
