import { Router } from 'express';
import { calculateForStudent, calculateForAll, getStudentHistory, getStudentsList, updateFreeCard, generateAiRecommendation } from '../controller/performance.controller';
import { authenticate } from '../../../middleware/authenticate';
import { authorize } from '../../../middleware/authorize';
import { Role } from '@prisma/client';

const router = Router();

// Calculate for a specific student
router.post(
  '/student/:id/calculate',
  authenticate,
  authorize(Role.MANAGER, Role.TEACHER, Role.ADMIN),
  calculateForStudent
);

// Generate AI personalized recommendation for a student
router.post(
  '/ai-recommendation',
  authenticate,
  authorize(Role.MANAGER, Role.TEACHER, Role.ADMIN),
  generateAiRecommendation
);

router.post(
  '/student/:id/ai-recommendation',
  authenticate,
  authorize(Role.MANAGER, Role.TEACHER, Role.ADMIN),
  generateAiRecommendation
);

// Calculate for all students
router.post(
  '/calculate-all',
  authenticate,
  authorize(Role.MANAGER, Role.TEACHER, Role.ADMIN),
  calculateForAll
);

// Get student performance history
router.get(
  '/student/:id/history',
  authenticate,
  authorize(Role.MANAGER, Role.TEACHER, Role.STUDENT, Role.ADMIN),
  getStudentHistory
);

// Get students list with performance
router.get(
  '/students',
  authenticate,
  authorize(Role.MANAGER, Role.TEACHER, Role.ADMIN),
  getStudentsList
);

// Update student Free Card status
router.patch(
  '/student/:id/free-card',
  authenticate,
  authorize(Role.MANAGER, Role.ADMIN),
  updateFreeCard
);

export default router;
