import { z } from 'zod';

export const createStudyMaterialSchema = z.object({
  subjectId: z.string().uuid("Invalid subject ID"),
  title: z.string().min(1, "Title is required").max(255, "Title must be under 255 characters"),
  batch: z.string().optional(),
  fileUrls: z.array(z.string()).optional(),
  text: z.string().optional(),
});

export type CreateStudyMaterialDto = z.infer<typeof createStudyMaterialSchema>;
