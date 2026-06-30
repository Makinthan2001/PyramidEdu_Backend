import { Router } from 'express';
import { ManagerController } from '../controller/manager.controller';
import { authenticate } from '../../../middleware/authenticate';
import { adminOrManager } from '../../../middleware/authorize';

const router = Router();

// All manager routes require authentication and manager/admin role
router.use(authenticate, adminOrManager);

router.get('/registered-students', ManagerController.getRegisteredStudents);
router.get('/registered-students/:id', ManagerController.getRegisteredStudentById);
router.patch('/registered-students/:id/payment-status', ManagerController.updatePaymentStatus);
router.patch('/registered-students/:id/approval-status', ManagerController.updateApprovalStatus);
router.get('/students', ManagerController.getApprovedStudents);
router.patch('/students/:id/toggle-status', ManagerController.toggleStudentStatus);
router.put('/students/:id', ManagerController.updateStudent);
router.post('/students/:id/re-enroll', ManagerController.reEnrollStudent);
router.get('/dashboard', ManagerController.getDashboardData);

export default router;
