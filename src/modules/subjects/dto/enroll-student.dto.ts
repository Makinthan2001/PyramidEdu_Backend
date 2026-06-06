import { z } from 'zod';

export const enrollStudentSchema = z.object({
  studentId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
});

export type EnrollStudentDto = z.infer<typeof enrollStudentSchema>;

export default {
  enrollStudentSchema,
};