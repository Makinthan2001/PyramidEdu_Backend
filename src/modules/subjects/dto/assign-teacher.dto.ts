import { z } from 'zod';

export const assignTeacherSchema = z.object({
  teacherId: z.string().uuid('Teacher ID must be a valid UUID'),
  batchIds: z.array(z.string().uuid('Invalid batch ID')).optional(),
});

export type AssignTeacherDto = z.infer<typeof assignTeacherSchema>;

export default {
  assignTeacherSchema,
};