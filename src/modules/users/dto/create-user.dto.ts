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
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z.coerce.date().refine((date) => {
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
      age--;
    }
    return age >= 16;
  }, 'Student must be at least 16 years old'),
  alExamBatch: z.string().min(1, 'A/L exam batch is required'),
  batchId: z.string().min(1, 'Batch ID is required'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  phone: z.string().regex(/^\d{10}$/, 'Phone number must be exactly 10 digits'),
  address: z.string().min(1, 'Address is required'),
  school: z.string().min(1, 'School is required'),
  email: emailField,
  nic: z.string().optional().or(z.literal('')),
  
  parentName: z.string().min(1, 'Parent name is required'),
  parentRelation: z.string().min(1, 'Parent relation is required'),
  parentEmail: z.string().email('Invalid parent email address').optional().or(z.literal('')),
  parentPhone: z.string().regex(/^\d{10}$/, 'Parent phone number must be exactly 10 digits').optional().or(z.literal('')),
  
  selectedStreamId: z.string().uuid('Invalid stream ID'),
  selectedCourseIds: z.array(z.string().uuid()).min(1, 'Select at least one subject').max(3, 'Select no more than 3 subjects'),
  selectedTeacherIds: z.record(z.string(), z.string().uuid()),
  paymentStatus: z.string().optional(),
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
