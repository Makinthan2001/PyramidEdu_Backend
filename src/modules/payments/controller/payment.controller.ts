import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../service/payment.service';
import { PaymentStatus } from '@prisma/client';

export class PaymentController {
  static async getDashboardOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await PaymentService.getDashboardOverview();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        subjectId: req.query.subjectId as string,
        batchId: req.query.batchId as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        paymentMethod: req.query.paymentMethod as string,
        paymentStatus: req.query.paymentStatus as string,
      };
      const data = await PaymentService.getAnalytics(filters);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        search: req.query.search as string,
        paymentStatus: req.query.paymentStatus as string,
        paymentMethod: req.query.paymentMethod as string,
        subjectId: req.query.subjectId as string,
        batchId: req.query.batchId as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 10,
        sortBy: req.query.sortBy as string,
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      };
      const result = await PaymentService.getPayments(filters);
      res.status(200).json({
        success: true,
        data: result.items,
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getFeeOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await PaymentService.getFeeOverview();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStudentSummaries(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        search: req.query.search as string,
        batchId: req.query.batchId as string,
        subjectId: req.query.subjectId as string,
        status: req.query.status as string,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 10,
      };
      const result = await PaymentService.getStudentSummaries(filters);
      res.status(200).json({
        success: true,
        data: result.items,
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPaymentDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = await PaymentService.getPaymentDetails(id as string);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updatePaymentStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const adminUser = (req as any).user?.fullName || 'Admin';

      if (!status || !Object.values(PaymentStatus).includes(status as PaymentStatus)) {
        res.status(400).json({ success: false, message: 'Invalid payment status value.' });
        return;
      }

      const updated = await PaymentService.updatePaymentStatus(id as string, status as PaymentStatus, adminUser);
      res.status(200).json({
        success: true,
        message: 'Payment status updated successfully.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getFeeRestrictionStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = req.params.studentId as string;
      const { FeePolicyService } = await import('../service/fee-policy.service');
      const data = await FeePolicyService.getStudentUnpaidFeeDetails(studentId);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async triggerFeeEnforcement(req: Request, res: Response, next: NextFunction) {
    try {
      const { FeePolicyService } = await import('../service/fee-policy.service');
      const results = await FeePolicyService.enforceAllStudentsFeePolicy();
      res.status(200).json({
        success: true,
        message: `Fee policy enforced across active students. Restricted student count: ${results.length}`,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }
}
