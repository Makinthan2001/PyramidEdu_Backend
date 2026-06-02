import { z } from 'zod';

export const createNoteSchema = z.object({
  subjectId: z.number().int().positive('subjectId must be a positive integer'),
  title: z.string().min(2).max(255),
  fileUrl: z.string().url(),
});

export type CreateNoteDto = z.infer<typeof createNoteSchema>;
