import { z } from 'zod';
import { ExamType } from '@prisma/client';

export const createExamSchema = z.object({
  subjectId: z.string().uuid('Subject ID must be a valid UUID'),
  termId: z.string().uuid('Term ID must be a valid UUID').optional(),
  examTitle: z.string().trim().min(2, 'Exam title must be at least 2 characters').max(255),
  examType: z.nativeEnum(ExamType).default(ExamType.MCQ),
  examDate: z.coerce.date(),
  totalMarks: z.number().int().positive('Total marks must be a positive integer').default(100),
  startTime: z.coerce.date().optional(),
  duration: z.number().int().positive('Duration must be positive').optional(),
  pdfUrl: z.string().url('Invalid PDF URL').optional().or(z.literal('')),
  batch: z.string().optional(),
  batchId: z.string().uuid().optional(),
});

export type CreateExamDto = z.infer<typeof createExamSchema>;
