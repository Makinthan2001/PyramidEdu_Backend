import { Router } from 'express';
import authRoutes from './auth';
import healthRoutes from './health';
import examRoutes from './exam';
import notificationRoutes from './notification/notification.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/health', healthRoutes);
router.use('/exams', examRoutes);
router.use('/notifications', notificationRoutes);

export default router;