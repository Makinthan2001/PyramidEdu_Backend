import { z } from 'zod';
import { UserRole } from '@prisma/client';

// Email field used across DTOs
const emailField = z
  .string()
  .email('Invalid email format')
  .max(255, 'Email must not exceed 255 characters');

// Manager DTO
export const createManagerSchema = z.object({
  role: z.literal('MANAGER'),
  firstName: z.string().min(1, 'First name is required').max(255),
  lastName: z.string().min(1, 'Last name is required').max(255),
  nicNumber: z.string().min(10, 'NIC number is required').max(20),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  address: z.string().min(3, 'Address is required').max(500),
  email: emailField,
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 digits'),
  salary: z.number().positive('Salary must be positive').optional(),
});

export type CreateManagerDto = z.infer<typeof createManagerSchema>;

// Teacher DTO
export const createTeacherSchema = z.object({
  role: z.literal('TEACHER'),
  firstName: z.string().min(1, 'First name is required').max(255),
  lastName: z.string().min(1, 'Last name is required').max(255),
  nicNumber: z.string().min(10, 'NIC number is required').max(20),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  address: z.string().min(3, 'Address is required').max(500),
  subject: z.string().min(1, 'Subject is required').max(255),
  email: emailField,
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 digits'),
  salary: z.number().positive('Salary must be positive').optional(),
});

export type CreateTeacherDto = z.infer<typeof createTeacherSchema>;

// Support Staff DTO
export const createSupportStaffSchema = z.object({
  role: z.literal('SUPPORT_STAFF'),
  firstName: z.string().min(1, 'First name is required').max(255),
  lastName: z.string().min(1, 'Last name is required').max(255),
  nicNumber: z.string().min(1, 'NIC number is required').max(20),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  address: z.string().min(1, 'Address is required').max(500),
  roleType: z.string().min(1, 'Role is required').max(255),
  email: emailField,
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 digits'),
  salary: z.number().positive('Salary must be positive').optional(),
});

export type CreateSupportStaffDto = z.infer<typeof createSupportStaffSchema>;

// Student DTO
export const createStudentSchema = z.object({
  role: z.literal('STUDENT'),
  firstName: z.string().min(1, 'First name is required').max(255),
  lastName: z.string().min(1, 'Last name is required').max(255),
  indexNumber: z.string().min(1, 'Index number is required').max(255),
  dateOfBirth: z.coerce.date(),
  address: z.string().min(1, 'Address is required').max(500),
  email: emailField,
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 digits'),
});

export type CreateStudentDto = z.infer<typeof createStudentSchema>;

// Admin can create any role - flexible schema
export const createAdminSchema = z.object({
  role: z.enum(['ADMIN', 'MANAGER', 'TEACHER', 'STUDENT', 'SUPPORT_STAFF']),
  // Common fields
  email: emailField,
  // Manager fields
  firstName: z.string().max(255).optional(),
  lastName: z.string().max(255).optional(),
  nicNumber: z.string().max(20).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  address: z.string().max(500).optional(),
  salary: z.number().positive().optional(),
  // Teacher fields
  subject: z.string().max(255).optional(),
  // Student fields
  indexNumber: z.string().max(255).optional(),
  dateOfBirth: z.coerce.date().optional(),
  // Support Staff fields
  roleType: z.string().max(255).optional(),
  // Common optional
  phoneNumber: z.string().min(10).optional(),
});

export type CreateAdminDto = z.infer<typeof createAdminSchema>;

// Union of all create DTOs
export type CreateUserDto =
  | (CreateManagerDto & { role: 'MANAGER' })
  | (CreateTeacherDto & { role: 'TEACHER' })
  | (CreateStudentDto & { role: 'STUDENT' })
  | (CreateSupportStaffDto & { role: 'SUPPORT_STAFF' })
  | (CreateAdminDto & { role: 'ADMIN' });

export default {
  createManagerSchema,
  createTeacherSchema,
  createSupportStaffSchema,
  createStudentSchema,
  createAdminSchema,
};
