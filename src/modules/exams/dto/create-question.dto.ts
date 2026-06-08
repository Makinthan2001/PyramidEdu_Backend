import { z } from 'zod';
import { QuestionType } from '@prisma/client';

export const createQuestionSchema = z.object({
  examId: z.string().uuid('Exam ID must be a valid UUID').optional(),
  questionText: z.string().trim().min(5, 'Question text must be at least 5 characters'),
  questionType: z.nativeEnum(QuestionType),
  marks: z.number().int().positive('Marks must be a positive integer').default(1),
  options: z.array(
    z.object({
      id: z.string(),
      text: z.string().min(1, 'Option text cannot be empty'),
    })
  ).optional(),
  correctAnswer: z.string().optional(),
  order: z.number().int().min(0).default(0),
}).superRefine((data, ctx) => {
  if (data.questionType === QuestionType.MCQ) {
    if (!data.options || data.options.length < 2 || data.options.length > 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MCQ must have between 2 and 6 options',
        path: ['options'],
      });
    } else if (!data.correctAnswer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MCQ must have a correct answer selected',
        path: ['correctAnswer'],
      });
    } else {
      const isValidAnswer = data.options.some((opt) => opt.id === data.correctAnswer);
      if (!isValidAnswer) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Correct answer must match one of the option IDs',
          path: ['correctAnswer'],
        });
      }
    }
  }

  if (data.questionType === QuestionType.TRUE_FALSE) {
    if (!data.correctAnswer || !['TRUE', 'FALSE'].includes(data.correctAnswer.toUpperCase())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'TRUE_FALSE must have a correct answer of TRUE or FALSE',
        path: ['correctAnswer'],
      });
    }
  }
});

export type CreateQuestionDto = z.infer<typeof createQuestionSchema>;
