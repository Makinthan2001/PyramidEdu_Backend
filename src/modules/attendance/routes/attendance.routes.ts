import { Router } from 'express';
import { AttendanceController } from '../controller/attendance.controller';
import { authenticate } from '../../../middleware/authenticate';
import { authorize } from '../../../middleware/authorize';
import { Role } from '@prisma/client';
import rateLimit from 'express-rate-limit';

const router = Router();

const scanLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 requests per `window` (here, per minute)
  message: { error: 'Too many scans from this IP, please try again after a minute.' },
});

router.post(
  '/qr',
  scanLimit,
  authenticate,
  authorize(Role.ADMIN, Role.MANAGER, Role.TEACHER),
  AttendanceController.markByQR
);

export default router;
