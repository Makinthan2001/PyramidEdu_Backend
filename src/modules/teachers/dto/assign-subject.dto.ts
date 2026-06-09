import { z } from 'zod';

export const assignSubjectSchema = z.object({
  subjectId: z.string().uuid('subjectId must be a valid UUID'),
});

export type AssignSubjectDto = z.infer<typeof assignSubjectSchema>;
