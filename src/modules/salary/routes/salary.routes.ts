import { Router } from 'express';
import { SalaryController } from '../controller/salary.controller';
import { jwtGuard } from '../../auth/guards/jwt.guard';
import { roleGuard } from '../../auth/guards/role.guard';
import { Role } from '@prisma/client';

const router = Router();

// Protect all salary routes
router.use(jwtGuard);
router.use(roleGuard(Role.ADMIN, Role.MANAGER));

router.get('/dashboard-overview', SalaryController.getDashboardOverview);
router.get('/analytics', SalaryController.getAnalytics);
router.get('/employees', SalaryController.getEmployees);

router.post('/payrolls/generate', SalaryController.generateMonthlyPayroll);
router.patch('/records/:id/process', SalaryController.processPayment);
router.patch('/employees/:employeeId/basic-salary', SalaryController.updateBasicSalary);


router.get('/records/:id/payslip', SalaryController.getPayslipDetails);

export default router;
