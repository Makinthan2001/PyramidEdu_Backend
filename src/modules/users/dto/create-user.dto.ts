import { z } from 'zod';
import { Role } from '@prisma/client';

// Email field used across DTOs
const emailField = z
  .string()
  .email('Invalid email format')
  .max(255, 'Email must not exceed 255 characters');

// Manager DTO
export const createManagerSchema = z.object({
  role: z.literal('MANAGER'),
  fullName: z.string().min(1, 'Full name is required').max(255),
  nic: z.string().min(10, 'NIC number is required').max(20),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  address: z.string().min(3, 'Address is required').max(500),
  email: emailField,
  password: z.string().min(1, 'Password is required').optional(),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  salary: z.number().positive('Salary must be positive').optional(),
});

export type CreateManagerDto = z.infer<typeof createManagerSchema>;

// Teacher DTO
export const createTeacherSchema = z.object({
  role: z.literal('TEACHER'),
  fullName: z.string().min(1, 'Full name is required').max(255),
  nic: z.string().min(10, 'NIC number is required').max(20),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  address: z.string().min(3, 'Address is required').max(500),
  subjectId: z.string().uuid('Subject ID must be a valid UUID').optional(),
  email: emailField,
  password: z.string().min(1, 'Password is required').optional(),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  salary: z.number().positive('Salary must be positive').optional(),
});

export type CreateTeacherDto = z.infer<typeof createTeacherSchema>;

// Student DTO
export const createStudentSchema = z.object({
  role: z.literal('STUDENT'),
  fullName: z.string().min(1, 'Full name is required').max(255),
  indexNumber: z.string().min(1, 'Index number is required').max(255),
  dateOfBirth: z.coerce.date(),
  address: z.string().min(1, 'Address is required').max(500),
  email: emailField,
  password: z.string().min(1, 'Password is required').optional(),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  nic: z.string().min(10).max(20).optional(),
  batch: z.string().optional(),
});

export type CreateStudentDto = z.infer<typeof createStudentSchema>;

// Admin DTO
export const createAdminSchema = z.object({
  role: z.literal('ADMIN'),
  fullName: z.string().min(1, 'Full name is required').max(255),
  email: emailField,
  password: z.string().min(1, 'Password is required'),
  phone: z.string().min(10).optional(),
  accessLevel: z.number().int().min(1).default(1),
});

export type CreateAdminDto = z.infer<typeof createAdminSchema>;

// Union of all create DTOs
export type CreateUserDto =
  | (CreateManagerDto & { role: 'MANAGER' })
  | (CreateTeacherDto & { role: 'TEACHER' })
  | (CreateStudentDto & { role: 'STUDENT' })
  | (CreateAdminDto & { role: 'ADMIN' });

export default {
  createManagerSchema,
  createTeacherSchema,
  createStudentSchema,
  createAdminSchema,
};
