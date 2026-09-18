import { Router } from 'express';
import { Role } from '@prisma/client';
import { jwtGuard } from '../../auth/guards/jwt.guard';
import { roleGuard } from '../../auth/guards/role.guard';
import { PaymentController } from '../controller/payment.controller';

const router = Router();

// Protect all payment routes with JWT
router.use(jwtGuard);

// Route accessible by students (to check their fee restriction status) as well as managers/admins
router.get(
  '/fee-enforcement/status/:studentId',
  roleGuard(Role.ADMIN, Role.MANAGER, Role.STUDENT),
  PaymentController.getFeeRestrictionStatus
);

// Protect remaining payment administration routes with ADMIN/MANAGER role guards
router.use(roleGuard(Role.ADMIN, Role.MANAGER));

router.get('/dashboard-overview', PaymentController.getDashboardOverview);
router.get('/analytics', PaymentController.getAnalytics);
router.get('/fee-overview', PaymentController.getFeeOverview);
router.get('/student-summaries', PaymentController.getStudentSummaries);
router.post('/fee-enforcement/trigger-check', PaymentController.triggerFeeEnforcement);
router.get('/details/:id', PaymentController.getPaymentDetails);
router.get('/', PaymentController.getPayments);
router.patch('/:id/status', PaymentController.updatePaymentStatus);

export default router;
