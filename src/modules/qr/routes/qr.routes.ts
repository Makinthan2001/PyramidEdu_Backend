import { Router } from 'express';
import { QRController } from '../controller/qr.controller';
import { authenticate } from '../../../middleware/authenticate';
import { authorize } from '../../../middleware/authorize';
import { Role } from '@prisma/client';

const router = Router();

router.post(
  '/generate/:studentId',
  authenticate,
  authorize(Role.ADMIN, Role.MANAGER),
  QRController.generateQR
);

router.get(
  '/:studentId',
  authenticate,
  authorize(Role.ADMIN, Role.MANAGER),
  QRController.getStudentQR
);

export default router;
