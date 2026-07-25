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

router.get('/allowances', SalaryController.getAllowances);
router.post('/allowances', SalaryController.createAllowance);
router.delete('/allowances/:id', SalaryController.deleteAllowance);

router.get('/deductions', SalaryController.getDeductions);
router.post('/deductions', SalaryController.createDeduction);
router.delete('/deductions/:id', SalaryController.deleteDeduction);

router.get('/records/:id/payslip', SalaryController.getPayslipDetails);

export default router;
