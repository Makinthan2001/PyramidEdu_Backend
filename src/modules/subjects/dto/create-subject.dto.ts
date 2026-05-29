import { z } from 'zod';

const feePerMonthSchema = z
  .number()
  .positive('Fee per month must be a positive number')
  .refine((value) => Number.isInteger(value * 100), {
    message: 'Fee per month can have at most 2 decimal places',
  });

export const createSubjectSchema = z.object({
  name: z.string().trim().min(2, 'Subject name must be at least 2 characters').max(100),
  code: z
    .string()
    .trim()
    .min(1, 'Subject code is required')
    .max(20, 'Subject code must not exceed 20 characters')
    .regex(/^[a-zA-Z0-9]+$/, 'Subject code must be alphanumeric')
    .optional(),
  feePerMonth: feePerMonthSchema,
  streamIds: z.array(z.number().int().positive()).min(1, 'At least one stream is required'),
  isActive: z.boolean().optional(),
  description: z.string().trim().max(500).optional(),
});

export type CreateSubjectDto = z.infer<typeof createSubjectSchema>;

export default {
  createSubjectSchema,
};