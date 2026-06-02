import { z } from 'zod';

export const assignSubjectSchema = z.object({
  subjectId: z.number().int().positive('Subject ID must be a positive integer'),
});

export type AssignSubjectDto = z.infer<typeof assignSubjectSchema>;
