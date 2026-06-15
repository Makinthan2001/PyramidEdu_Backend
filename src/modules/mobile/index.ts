import { Router } from 'express';
import authRoutes from './auth';
import healthRoutes from './health';
import examRoutes from './exam';

const router = Router();

router.use('/auth', authRoutes);
router.use('/health', healthRoutes);
router.use('/exams', examRoutes);

export default router;