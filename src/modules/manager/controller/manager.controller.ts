import { Request, Response, NextFunction } from 'express';
import { ManagerService } from '../service/manager.service';
import { AppError } from '../../../utils/AppError';
import { ApprovalStatus, RegistrationPaymentStatus } from '@prisma/client';

export class ManagerController {
  static async getRegisteredStudents(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ManagerService.getRegisteredStudents();
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getRegisteredStudentById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = await ManagerService.getRegisteredStudentById(id as string);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async updatePaymentStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { paymentStatus } = req.body;

      if (!Object.values(RegistrationPaymentStatus).includes(paymentStatus)) {
        throw new AppError('Invalid payment status.', 400);
      }

      const data = await ManagerService.updatePaymentStatus(id as string, paymentStatus);
      res.status(200).json({ success: true, message: 'Payment status updated successfully.', data });
    } catch (error) {
      next(error);
    }
  }

  static async updateApprovalStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { approvalStatus } = req.body;

      if (!Object.values(ApprovalStatus).includes(approvalStatus)) {
        throw new AppError('Invalid approval status.', 400);
      }

      const data = await ManagerService.updateApprovalStatus(id as string, approvalStatus);
      res.status(200).json({ success: true, message: 'Approval status updated successfully.', data });
    } catch (error) {
      next(error);
    }
  }
}

export default ManagerController;
