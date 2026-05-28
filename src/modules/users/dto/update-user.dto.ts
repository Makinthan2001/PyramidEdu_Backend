import { z } from 'zod';

const emailField = z
  .string()
  .email('Invalid email format')
  .max(255, 'Email must not exceed 255 characters')
  .optional();

// Update user DTO - flexible for all role types
export const updateUserSchema = z.object({
  // Common optional fields
  email: emailField,
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 digits').optional(),
  
  // Name fields
  fullName: z.string().min(1).max(255).optional(),
  firstName: z.string().min(1).max(255).optional(),
  lastName: z.string().min(1).max(255).optional(),
  
  // Identification & Demographic
  nicNumber: z.string().min(1).max(20).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  address: z.string().min(1).max(500).optional(),
  
  // Role-specific fields
  subject: z.string().min(1).max(255).optional(),
  indexNumber: z.string().min(1).max(255).optional(),
  parentName: z.string().min(1).max(255).optional(),
  parentPhone: z.string().min(10).optional(),
  roleType: z.string().min(1).max(255).optional(),
  
  // Salary
  salary: z.number().positive('Salary must be positive').optional(),
});

export type UpdateUserDto = z.infer<typeof updateUserSchema>;

export default {
  updateUserSchema,
};
