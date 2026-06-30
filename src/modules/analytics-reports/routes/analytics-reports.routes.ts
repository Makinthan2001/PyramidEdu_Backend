import { Router } from 'express';
import { AnalyticsReportsController } from '../controller/analytics-reports.controller';
import { authenticate } from '../../../middleware/authenticate';
import { adminOrManager } from '../../../middleware/authorize';

const router = Router();

// Protected Analytics Endpoints (restricted to Admin and Manager roles)
router.get('/dashboard', authenticate, adminOrManager, AnalyticsReportsController.getDashboard);
router.get('/students', authenticate, adminOrManager, AnalyticsReportsController.getStudents);
router.get('/teachers', authenticate, adminOrManager, AnalyticsReportsController.getTeachers);
router.get('/subjects', authenticate, adminOrManager, AnalyticsReportsController.getSubjects);
router.get('/attendance', authenticate, adminOrManager, AnalyticsReportsController.getAttendance);
router.get('/exams', authenticate, adminOrManager, AnalyticsReportsController.getExams);
router.get('/performance', authenticate, adminOrManager, AnalyticsReportsController.getPerformance);
router.get('/payments', authenticate, adminOrManager, AnalyticsReportsController.getPayments);
router.get('/export/csv', authenticate, adminOrManager, AnalyticsReportsController.exportCsv);

export default router;
