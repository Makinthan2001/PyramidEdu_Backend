import { z } from 'zod';

export const updateTeacherSchema = z.object({
  firstName: z.string().min(2).max(100).optional(),
  lastName: z.string().min(2).max(100).optional(),
  phone: z.string().regex(/^\+?[0-9]{7,15}$/, 'Invalid phone format').optional(),
  address: z.string().min(5).max(255).optional(),
  specialization: z.string().min(2).max(100).optional(),
  salary: z.number().positive().optional(),
});

export type UpdateTeacherDto = z.infer<typeof updateTeacherSchema>;
