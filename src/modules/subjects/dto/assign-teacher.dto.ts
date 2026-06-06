import { z } from 'zod';

export const assignTeacherSchema = z.object({
  teacherId: z.string().uuid('Teacher ID must be a valid UUID'),
});

export type AssignTeacherDto = z.infer<typeof assignTeacherSchema>;

export default {
  assignTeacherSchema,
};