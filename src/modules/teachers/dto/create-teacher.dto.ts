import { z } from 'zod';

export const createTeacherSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).optional(),
  fullName: z.string().min(2).max(200),
  nic: z.string().min(6).max(20),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  address: z.string().min(5).max(255),
  phone: z.string().regex(/^\+?[0-9]{7,15}$/, 'Invalid phone format').optional(),
  subjectId: z.string().uuid('subjectId must be a valid UUID').optional(),
  salary: z.number().positive().optional(),
});

export type CreateTeacherDto = z.infer<typeof createTeacherSchema>;
