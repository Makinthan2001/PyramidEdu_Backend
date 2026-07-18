import { Router } from 'express';
import { getTodayStatus, generateQuiz, submitQuiz } from '../controller/practice-mcq.controller';
import { authenticate } from '../../../middleware/authenticate';
import { authorize } from '../../../middleware/authorize';
import { Role } from '@prisma/client';

const router = Router();

// Get today's attempt status and streaks
router.get(
  '/today-status',
  authenticate,
  authorize(Role.STUDENT),
  getTodayStatus
);

// Generate today's practice MCQ quiz
router.post(
  '/generate',
  authenticate,
  authorize(Role.STUDENT),
  generateQuiz
);

// Submit answers for the practice quiz
router.post(
  '/submit',
  authenticate,
  authorize(Role.STUDENT),
  submitQuiz
);

export default router;
