import { Router } from 'express';
import { Role } from '@prisma/client';
import { jwtGuard } from '../../../modules/auth/guards/jwt.guard';
import { roleGuard } from '../../../modules/auth/guards/role.guard';
import { validate } from '../../../middleware/validate';
import * as controller from '../controller/teachers.controller';
import { teachersValidator } from '../validators/teachers.validator';

const router = Router();

// Protected routes
router.use(jwtGuard);

// ADMIN & MANAGER can list all teachers
router.get('/', roleGuard(Role.ADMIN, Role.MANAGER), controller.getTeachers);

// Get teacher by ID – ADMIN, MANAGER, or the teacher themselves
router.get('/:id', roleGuard(Role.ADMIN, Role.MANAGER, Role.TEACHER), controller.getTeacherById);

// Create teacher – ADMIN only
router.post('/', roleGuard(Role.ADMIN), validate(teachersValidator.createTeacherSchema), controller.createTeacher);

// Update teacher – ADMIN or MANAGER
router.patch('/:id', roleGuard(Role.ADMIN, Role.MANAGER), validate(teachersValidator.updateTeacherSchema), controller.updateTeacher);

// Delete (soft) teacher – ADMIN only
router.delete('/:id', roleGuard(Role.ADMIN), controller.deleteTeacher);

// Self‑service routes for the logged‑in teacher
router.get('/me', roleGuard(Role.TEACHER), controller.getMyProfile);
router.patch('/me', roleGuard(Role.TEACHER), validate(teachersValidator.updateTeacherSchema), controller.updateMyProfile);

// Teacher's subjects list – ADMIN, MANAGER, TEACHER (own)
router.get('/:id/subjects', roleGuard(Role.ADMIN, Role.MANAGER, Role.TEACHER), controller.getTeacherSubjects);

// Salary update – ADMIN only
router.patch('/:id/salary', roleGuard(Role.ADMIN), controller.updateSalary);

// Assign subject – ADMIN or MANAGER
router.patch('/:id/subjects', roleGuard(Role.ADMIN, Role.MANAGER), validate(teachersValidator.assignSubjectSchema), controller.assignSubject);

export default router;
