import { Router } from 'express';
import { UserRole } from '@prisma/client';
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

router.use(jwtGuard);

router.get('/streams', controller.getStreams);
router.post('/streams', roleGuard(UserRole.ADMIN, UserRole.MANAGER), validate(createStreamSchema), controller.createStream);

router.get('/', controller.getSubjects);
router.get('/:id', controller.getSubjectById);

router.post('/', roleGuard(UserRole.ADMIN, UserRole.MANAGER), validate(createSubjectSchema), controller.createSubject);
router.patch('/:id', roleGuard(UserRole.ADMIN, UserRole.MANAGER), validate(updateSubjectSchema), controller.updateSubject);
router.delete('/:id', roleGuard(UserRole.ADMIN, UserRole.MANAGER), controller.deactivateSubject);
router.patch('/:id/assign-teacher', roleGuard(UserRole.ADMIN, UserRole.MANAGER), validate(assignTeacherSchema), controller.assignTeacher);

router.get('/:id/students', roleGuard(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER), controller.getSubjectStudents);
router.post('/:id/enroll', roleGuard(UserRole.ADMIN, UserRole.MANAGER, UserRole.STUDENT), validate(enrollStudentSchema), controller.enrollStudent);
router.delete('/:id/unenroll/:sid', roleGuard(UserRole.ADMIN, UserRole.MANAGER, UserRole.STUDENT), controller.unenrollStudent);
router.get('/:id/enrollmentcount', roleGuard(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER), controller.getEnrollmentCount);
router.get('/:id/enrollment-count', roleGuard(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER), controller.getEnrollmentCount);

export default router;