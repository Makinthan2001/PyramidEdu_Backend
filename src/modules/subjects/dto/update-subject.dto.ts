import { z } from 'zod';

const feeAmountSchema = z
  .number()
  .positive('Fee amount must be a positive number')
  .refine((value) => Number.isInteger(value * 100), {
    message: 'Fee amount can have at most 2 decimal places',
  });

export const updateSubjectSchema = z.object({
  subjectName: z.string().trim().min(2, 'Subject name must be at least 2 characters').max(100).optional(),
  subjectCode: z
    .string()
    .trim()
    .min(1, 'Subject code is required')
    .max(20, 'Subject code must not exceed 20 characters')
    .optional(),
  feeAmount: feeAmountSchema.optional(),
  // Accept either an array of stream IDs (preferred) or a single streamId (backwards compat)
  streamIds: z.array(z.string().uuid()).optional(),
  streamId: z.string().uuid('Stream ID must be a valid UUID').optional(),
  isActive: z.boolean().optional(),
});

export type UpdateSubjectDto = z.infer<typeof updateSubjectSchema>;

export default {
  updateSubjectSchema,
};