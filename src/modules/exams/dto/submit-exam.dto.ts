import { z } from 'zod';

export const submitExamSchema = z.object({
  answers: z.record(
    z.string().uuid('Question ID must be valid'),
    z.string().min(1, 'Answer cannot be empty')
  ).optional(),
  answerPdfUrl: z.string().url('Must be a valid URL').optional(),
  answerPdfPublicId: z.string().optional(),
});

export type SubmitExamDto = z.infer<typeof submitExamSchema>;
