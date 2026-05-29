import { z } from 'zod';

export const assignTeacherSchema = z.object({
  teacherId: z.number().int().positive('Teacher ID is required'),
});

export type AssignTeacherDto = z.infer<typeof assignTeacherSchema>;

export default {
  assignTeacherSchema,
};