import { Router } from 'express';
import { calculateForStudent, calculateForAll, getStudentHistory, getStudentsList, updateFreeCard } from '../controller/performance.controller';
import { authenticate } from '../../../middleware/authenticate';
import { authorize } from '../../../middleware/authorize';
import { Role } from '@prisma/client';

const router = Router();

// Calculate for a specific student
router.post(
  '/student/:id/calculate',
  authenticate,
  authorize(Role.MANAGER, Role.TEACHER),
  calculateForStudent
);

// Calculate for all students
router.post(
  '/calculate-all',
  authenticate,
  authorize(Role.MANAGER),
  calculateForAll
);

// Get student performance history
router.get(
  '/student/:id/history',
  authenticate,
  authorize(Role.MANAGER, Role.TEACHER, Role.STUDENT),
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
