import { Router } from 'express';
import { Role } from '@prisma/client';
import { jwtGuard } from '../../../modules/auth/guards/jwt.guard';
import { roleGuard } from '../../../modules/auth/guards/role.guard';
import { validate } from '../../../middleware/validate';
import * as controller from '../controller/exams.controller';
import validators from '../validators/exams.validator';

const router = Router();

router.use(jwtGuard);

// ----------------------------------------------------
// STUDENT ROUTES
// ----------------------------------------------------
router.get('/my-upcoming', roleGuard(Role.STUDENT), controller.getMyUpcomingExams);
router.get('/:id/questions', roleGuard(Role.STUDENT), controller.getStudentQuestions);
router.post('/:id/submit', roleGuard(Role.STUDENT), validate(validators.submitExamSchema), controller.submitExam);

// ----------------------------------------------------
// TEACHER / ADMIN ROUTES
// ----------------------------------------------------
router.post(
  '/',
  roleGuard(Role.TEACHER, Role.ADMIN),
  validate(validators.createExamSchema),
  controller.createExam
);

router.get(
  '/',
  roleGuard(Role.TEACHER, Role.ADMIN),
  controller.getExams
);

router.get(
  '/:id',
  roleGuard(Role.TEACHER, Role.ADMIN),
  controller.getExamById
);

router.get(
  '/:id/submissions',
  roleGuard(Role.TEACHER, Role.ADMIN),
  controller.getExamSubmissions
);

router.patch(
  '/:id',
  roleGuard(Role.TEACHER, Role.ADMIN),
  validate(validators.updateExamSchema),
  controller.updateExam
);

router.delete(
  '/:id',
  roleGuard(Role.TEACHER, Role.ADMIN),
  controller.deleteExam
);

router.post(
  '/:id/questions',
  roleGuard(Role.TEACHER, Role.ADMIN),
  validate(validators.createQuestionSchema),
  controller.addQuestion
);

router.patch(
  '/:id/questions/:questionId',
  roleGuard(Role.TEACHER, Role.ADMIN),
  validate(validators.createQuestionSchema),
  controller.updateQuestion
);

router.delete(
  '/:id/questions/:questionId',
  roleGuard(Role.TEACHER, Role.ADMIN),
  controller.deleteQuestion
);

export default router;
