import { z } from 'zod';

export const enrollStudentSchema = z.object({
  studentId: z.number().int().positive().optional(),
});

export type EnrollStudentDto = z.infer<typeof enrollStudentSchema>;

export default {
  enrollStudentSchema,
};