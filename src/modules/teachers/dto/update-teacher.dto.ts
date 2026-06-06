import { z } from 'zod';

export const updateTeacherSchema = z.object({
  fullName: z.string().min(2).max(200).optional(),
  phone: z.string().regex(/^\+?[0-9]{7,15}$/, 'Invalid phone format').optional(),
  address: z.string().min(5).max(255).optional(),
  subjectId: z.string().uuid('subjectId must be a valid UUID').optional(),
  salary: z.number().positive().optional(),
  nic: z.string().min(6).max(20).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
});

export type UpdateTeacherDto = z.infer<typeof updateTeacherSchema>;
