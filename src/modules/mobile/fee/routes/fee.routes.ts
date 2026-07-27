import { Router } from 'express';
import { MobileFeeController } from '../controller/fee.controller';
import { authenticateMobileStudent } from '../../auth/middleware/authenticate';

const router = Router();

// Public Stripe redirect and webhook endpoints
router.get('/stripe-success', MobileFeeController.stripeSuccess);
router.get('/stripe-cancel', MobileFeeController.stripeCancel);
router.post('/stripe-webhook', MobileFeeController.stripeWebhook);

// Apply auth middleware to all routes below
router.use(authenticateMobileStudent);

router.get('/history', MobileFeeController.getFeeHistory);
router.post('/pay', MobileFeeController.processPayment);
router.post('/pay-stripe', MobileFeeController.processPaymentStripe);

export default router;
