import { Router } from 'express';
import { Role } from '@prisma/client';
import { jwtGuard } from '../../../modules/auth/guards/jwt.guard';
import { roleGuard } from '../../../modules/auth/guards/role.guard';
import { validate } from '../../../middleware/validate';
import * as controller from '../controller/subjects.controller';
import {
  createSubjectSchema,
  createStreamSchema,
  updateSubjectSchema,
  enrollStudentSchema,
  assignTeacherSchema,
} from '../validators/subjects.validator';

const router = Router();

// Public read-only endpoints for the student registration flow.
router.get('/streams', controller.getStreams);
router.get('/available', controller.getAvailableSubjects);
router.get('/teachers', controller.getTeachersForSubject);

router.use(jwtGuard);

router.post('/streams', roleGuard(Role.ADMIN, Role.MANAGER), validate(createStreamSchema), controller.createStream);
router.patch('/streams/:id', roleGuard(Role.ADMIN, Role.MANAGER), controller.updateStream);

router.get('/', controller.getSubjects);
router.get('/:id', controller.getSubjectById);

router.post('/', roleGuard(Role.ADMIN, Role.MANAGER), validate(createSubjectSchema), controller.createSubject);
router.patch('/:id', roleGuard(Role.ADMIN, Role.MANAGER), validate(updateSubjectSchema), controller.updateSubject);
router.delete('/:id', roleGuard(Role.ADMIN, Role.MANAGER), controller.deactivateSubject);
router.patch('/:id/assign-teacher', roleGuard(Role.ADMIN, Role.MANAGER), validate(assignTeacherSchema), controller.assignTeacher);

router.get('/:id/students', roleGuard(Role.ADMIN, Role.MANAGER, Role.TEACHER), controller.getSubjectStudents);
router.post('/:id/enroll', roleGuard(Role.ADMIN, Role.MANAGER, Role.STUDENT), validate(enrollStudentSchema), controller.enrollStudent);
router.delete('/:id/unenroll/:sid', roleGuard(Role.ADMIN, Role.MANAGER, Role.STUDENT), controller.unenrollStudent);
router.get('/:id/enrollmentcount', roleGuard(Role.ADMIN, Role.MANAGER, Role.TEACHER), controller.getEnrollmentCount);
router.get('/:id/enrollment-count', roleGuard(Role.ADMIN, Role.MANAGER, Role.TEACHER), controller.getEnrollmentCount);

export default router;