import { Router } from 'express';
import { MobileFeeController } from '../controller/fee.controller';
import { authenticateMobileStudent } from '../../auth/middleware/authenticate';

const router = Router();

// Apply auth middleware to all routes in this file
router.use(authenticateMobileStudent);

router.get('/history', MobileFeeController.getFeeHistory);
router.post('/pay', MobileFeeController.processPayment);

export default router;
