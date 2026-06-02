import { z } from 'zod';

export const createTeacherSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).optional(), // will be hashed later
  firstName: z.string().min(2).max(100),
  lastName: z.string().min(2).max(100),
  nicNumber: z.string().min(6).max(20),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  address: z.string().min(5).max(255),
  phone: z.string().regex(/^\+?[0-9]{7,15}$/, 'Invalid phone format').optional(),
  specialization: z.string().min(2).max(100).optional(),
  salary: z.number().positive().optional(),
});

export const updateTeacherSchema = z.object({
  firstName: z.string().min(2).max(100).optional(),
  lastName: z.string().min(2).max(100).optional(),
  phone: z.string().regex(/^\+?[0-9]{7,15}$/, 'Invalid phone format').optional(),
  address: z.string().min(5).max(255).optional(),
  specialization: z.string().min(2).max(100).optional(),
  salary: z.number().positive().optional(),
});

export const assignSubjectSchema = z.object({
  subjectId: z.number().int().positive('subjectId must be a positive integer'),
});

// Optional convenience export
export const teachersValidator = {
  createTeacherSchema,
  updateTeacherSchema,
  assignSubjectSchema,
};
