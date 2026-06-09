import { z } from 'zod';
import { createExamSchema } from './create-exam.dto';

export const updateExamSchema = createExamSchema.partial().extend({
  isPublished: z.boolean().optional(),
  isApproved: z.boolean().optional(),
});

export type UpdateExamDto = z.infer<typeof updateExamSchema>;
