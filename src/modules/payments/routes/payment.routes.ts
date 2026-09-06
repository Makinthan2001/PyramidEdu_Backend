import { Router } from 'express';
import { Role } from '@prisma/client';
import { jwtGuard } from '../../auth/guards/jwt.guard';
import { roleGuard } from '../../auth/guards/role.guard';
import { PaymentController } from '../controller/payment.controller';

const router = Router();

// Protect all payment administration routes with JWT & ADMIN/MANAGER role guards
router.use(jwtGuard);
router.use(roleGuard(Role.ADMIN, Role.MANAGER));

router.get('/dashboard-overview', PaymentController.getDashboardOverview);
router.get('/analytics', PaymentController.getAnalytics);
router.get('/fee-overview', PaymentController.getFeeOverview);
router.get('/student-summaries', PaymentController.getStudentSummaries);
router.get('/fee-enforcement/status/:studentId', PaymentController.getFeeRestrictionStatus);
router.post('/fee-enforcement/trigger-check', PaymentController.triggerFeeEnforcement);
router.get('/details/:id', PaymentController.getPaymentDetails);
router.get('/', PaymentController.getPayments);
router.patch('/:id/status', PaymentController.updatePaymentStatus);

export default router;
