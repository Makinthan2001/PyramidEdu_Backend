import { z } from 'zod';
import { QuestionType } from '@prisma/client';

export const createQuestionSchema = z.object({
  examId: z.string().uuid('Exam ID must be a valid UUID').optional(),
  questionText: z.string().trim().optional().or(z.literal('')),
  imageUrl: z.string().url('Invalid image URL').optional().or(z.literal('')),
  questionType: z.nativeEnum(QuestionType),
  marks: z.number().int().positive('Marks must be a positive integer').default(1),
  options: z.array(
    z.object({
      id: z.string(),
      text: z.string().min(1, 'Option text cannot be empty'),
    })
  ),
  correctAnswer: z.string().min(1, 'Correct answer is required'),
  explanation: z.string().optional().or(z.literal('')),
  order: z.number().int().min(0).default(0),
}).superRefine((data, ctx) => {
  if (data.questionType === QuestionType.IMAGE && !data.imageUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Image URL is required for image-based questions',
      path: ['imageUrl'],
    });
  }
  if (data.questionType === QuestionType.TEXT && !data.questionText) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Question text is required for text-based questions',
      path: ['questionText'],
    });
  }
  if (!data.options || data.options.length < 2 || data.options.length > 6) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Question must have between 2 and 6 options',
      path: ['options'],
    });
  } else if (data.correctAnswer) {
    const isValidAnswer = data.options.some((opt) => opt.id === data.correctAnswer);
    if (!isValidAnswer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Correct answer must match one of the option IDs',
        path: ['correctAnswer'],
      });
    }
  }
});

export type CreateQuestionDto = z.infer<typeof createQuestionSchema>;
