import { Router } from 'express';
import { getTodayStatus, generateQuiz, submitQuiz, getQuizHistory, getQuizHistoryDetail } from '../controller/practice-mcq.controller';
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

// Get all quiz attempt history for the logged-in student
router.get(
  '/history',
  authenticate,
  authorize(Role.STUDENT),
  getQuizHistory
);

// Get specific history detail
router.get(
  '/history/:id',
  authenticate,
  authorize(Role.STUDENT),
  getQuizHistoryDetail
);

export default router;
