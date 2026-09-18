import { Router } from 'express';
import { ParentReportsController } from '../controller/parent-reports.controller';
import { authenticate } from '../../../middleware/authenticate';
import { adminOrManager } from '../../../middleware/authorize';

const router = Router();

// Manual trigger reports generation
router.post('/generate', authenticate, adminOrManager, ParentReportsController.generate);

// Get all generated reports (filtered by query)
router.get('/', authenticate, adminOrManager, ParentReportsController.getAll);

// Delete all reports for a specific month and year (Batch delete)
router.delete('/', authenticate, adminOrManager, ParentReportsController.deleteByPeriod);

// Delete an individual report by ID
router.delete('/:reportId', authenticate, adminOrManager, ParentReportsController.deleteById);

// Get a specific student's reports
router.get('/:studentId', authenticate, ParentReportsController.getStudentReports);

export default router;
