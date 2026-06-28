import { z } from 'zod';
import { ExamType } from '@prisma/client';

export const baseExamSchema = z.object({
  subjectId: z.string().uuid('Subject ID must be a valid UUID'),
  termId: z.string().uuid('Term ID must be a valid UUID').optional(),
  examTitle: z.string().trim().min(2, 'Exam title must be at least 2 characters').max(255),
  examType: z.nativeEnum(ExamType),
  examDate: z.coerce.date(),
  totalMarks: z.number().int().positive('Total marks must be a positive integer'),
  startTime: z.coerce.date().optional(),
  duration: z.number().int().positive('Duration must be positive').optional(),
  lateExamAvailableTime: z.number().int().nonnegative('Late exam time must be non-negative').optional(),
  pdfUrl: z.string().url('Invalid PDF URL').optional().or(z.literal('')),
  batch: z.string().optional(),
  batchId: z.string().uuid().optional(),
});

export const createExamSchema = baseExamSchema.extend({
  examType: z.nativeEnum(ExamType).default(ExamType.MCQ),
  totalMarks: z.number().int().positive('Total marks must be a positive integer').default(100),
});

export type CreateExamDto = z.infer<typeof createExamSchema>;
