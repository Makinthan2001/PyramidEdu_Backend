import { Router } from 'express';
import { Role } from '@prisma/client';
import { jwtGuard } from '../../../modules/auth/guards/jwt.guard';
import { roleGuard } from '../../../modules/auth/guards/role.guard';
import * as controller from '../controller/manual-exams.controller';

const router = Router();

// Protected routes
router.use(jwtGuard);
router.use(roleGuard(Role.TEACHER));

// Manual Exams routes for Teacher
router.post('/', controller.createManualExam);
router.get('/', controller.getAllManualExams);
router.get('/:id', controller.getManualExamById);
router.get('/:id/students', controller.getStudentsForManualExam);
router.post('/:id/marks', controller.saveMarks);

export default router;
