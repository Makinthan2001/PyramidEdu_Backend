import { Router } from 'express';
import { AttendanceController } from '../controller/attendance.controller';
import { authenticate } from '../../../middleware/authenticate';
import { authorize } from '../../../middleware/authorize';
import { Role } from '@prisma/client';
import rateLimit from 'express-rate-limit';

const router = Router();

const scanLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many scans from this IP, please try again after a minute.' },
});

router.post(
  '/qr',
  scanLimit,
  authenticate,
  authorize(Role.ADMIN, Role.MANAGER, Role.TEACHER),
  AttendanceController.markByQR
);

// Session Routes
router.post(
  '/sessions',
  authenticate,
  authorize(Role.ADMIN, Role.MANAGER, Role.TEACHER),
  AttendanceController.createSession
);

router.get(
  '/sessions',
  authenticate,
  authorize(Role.ADMIN, Role.MANAGER, Role.TEACHER),
  AttendanceController.fetchSession
);

router.patch(
  '/sessions/:id/start',
  authenticate,
  authorize(Role.ADMIN, Role.MANAGER, Role.TEACHER),
  AttendanceController.startSession
);

router.patch(
  '/sessions/:id/end',
  authenticate,
  authorize(Role.ADMIN, Role.MANAGER, Role.TEACHER),
  AttendanceController.endSession
);

router.get(
  '/students',
  authenticate,
  authorize(Role.ADMIN, Role.MANAGER, Role.TEACHER),
  AttendanceController.getStudents
);

router.post(
  '/manual',
  authenticate,
  authorize(Role.ADMIN, Role.MANAGER, Role.TEACHER),
  AttendanceController.markManual
);

// Manager Monitoring Routes
router.get(
  '/manager/summary',
  authenticate,
  authorize(Role.ADMIN, Role.MANAGER),
  AttendanceController.getManagerSummary
);

router.get(
  '/manager/student/:studentId',
  authenticate,
  authorize(Role.ADMIN, Role.MANAGER),
  AttendanceController.getManagerStudentDetails
);

// Teacher Monitoring Routes
router.get(
  '/teacher/summary',
  authenticate,
  authorize(Role.TEACHER),
  AttendanceController.getTeacherSummary
);

router.get(
  '/teacher/student/:studentId',
  authenticate,
  authorize(Role.TEACHER),
  AttendanceController.getTeacherStudentDetails
);

export default router;
