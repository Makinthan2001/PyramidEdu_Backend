import { z } from 'zod';

export const submitExamSchema = z.object({
  answers: z.record(
    z.string().uuid('Question ID must be valid'),
    z.string().min(1, 'Answer cannot be empty')
  ).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one answer must be provided',
  }),
});

export type SubmitExamDto = z.infer<typeof submitExamSchema>;
