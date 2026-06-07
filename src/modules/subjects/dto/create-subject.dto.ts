import { z } from 'zod';

const feeAmountSchema = z
  .number()
  .positive('Fee amount must be a positive number')
  .refine((value) => Number.isInteger(value * 100), {
    message: 'Fee amount can have at most 2 decimal places',
  });

export const createSubjectSchema = z.object({
  subjectName: z.string().trim().min(2, 'Subject name must be at least 2 characters').max(100),
  subjectCode: z
    .string()
    .trim()
    .min(1, 'Subject code is required')
    .max(20, 'Subject code must not exceed 20 characters')
    .optional(),
  feeAmount: feeAmountSchema,
  // Accept either an array of stream IDs (preferred) or a single streamId (backwards compat)
  streamIds: z.array(z.string().uuid()).min(1, 'At least one stream is required').optional(),
  streamId: z.string().uuid('Stream ID must be a valid UUID').optional(),
  isActive: z.boolean().optional(),
}).refine((data) => data.streamIds?.length || data.streamId, {
  message: 'At least one stream must be provided',
  path: ['streamIds'],
});

export type CreateSubjectDto = z.infer<typeof createSubjectSchema>;

export default {
  createSubjectSchema,
};