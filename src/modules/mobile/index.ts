import { Router } from 'express';
import authRoutes from './auth';
import healthRoutes from './health';
import examRoutes from './exam';
import notificationRoutes from './notification/notification.routes';
import feeRoutes from './fee/routes/fee.routes';
import profileRoutes from './profile/routes/profile.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/health', healthRoutes);
router.use('/exams', examRoutes);
router.use('/notifications', notificationRoutes);
router.use('/fees', feeRoutes);
router.use('/profile', profileRoutes);

export default router;