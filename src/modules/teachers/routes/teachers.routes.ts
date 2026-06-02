import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { jwtGuard } from '../../../modules/auth/guards/jwt.guard';
import { roleGuard } from '../../../modules/auth/guards/role.guard';
import { validate } from '../../../middleware/validate';
import * as controller from '../controller/teachers.controller';
import { teachersValidator } from '../validators/teachers.validator';

const router = Router();

// Public (no auth) – optional list could be restricted, but we keep it protected
// Protected routes
router.use(jwtGuard);

// ADMIN & MANAGER can list all teachers
router.get('/', roleGuard(UserRole.ADMIN, UserRole.MANAGER), controller.getTeachers);

// Get teacher by ID – ADMIN, MANAGER, or the teacher themselves
router.get('/:id', roleGuard(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER), controller.getTeacherById);

// Create teacher – ADMIN only
router.post('/', roleGuard(UserRole.ADMIN), validate(teachersValidator.createTeacherSchema), controller.createTeacher);

// Update teacher – ADMIN or MANAGER
router.patch('/:id', roleGuard(UserRole.ADMIN, UserRole.MANAGER), validate(teachersValidator.updateTeacherSchema), controller.updateTeacher);

// Delete (soft) teacher – ADMIN only
router.delete('/:id', roleGuard(UserRole.ADMIN), controller.deleteTeacher);

// Self‑service routes for the logged‑in teacher
router.get('/me', roleGuard(UserRole.TEACHER), controller.getMyProfile);
router.patch('/me', roleGuard(UserRole.TEACHER), validate(teachersValidator.updateTeacherSchema), controller.updateMyProfile);

// Teacher's subjects list – ADMIN, MANAGER, TEACHER (own)
router.get('/:id/subjects', roleGuard(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER), controller.getTeacherSubjects);

// Salary update – ADMIN only
router.patch('/:id/salary', roleGuard(UserRole.ADMIN), controller.updateSalary);

// Assign subject – ADMIN or MANAGER
router.patch('/:id/subjects', roleGuard(UserRole.ADMIN, UserRole.MANAGER), validate(teachersValidator.assignSubjectSchema), controller.assignSubject);

export default router;
