import { z } from 'zod';

export const createStreamSchema = z.object({
  name: z.string().trim().min(2, 'Stream name must be at least 2 characters').max(120),
  batchIds: z.array(z.string().uuid('Invalid batch ID')).optional(),
});

export type CreateStreamDto = z.infer<typeof createStreamSchema>;

export default {
  createStreamSchema,
};
