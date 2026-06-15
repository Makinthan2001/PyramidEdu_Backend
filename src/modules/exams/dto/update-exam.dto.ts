import { z } from 'zod';
import { baseExamSchema } from './create-exam.dto';

export const updateExamSchema = baseExamSchema.partial().extend({
  isPublished: z.boolean().optional(),
});

export type UpdateExamDto = z.infer<typeof updateExamSchema>;
