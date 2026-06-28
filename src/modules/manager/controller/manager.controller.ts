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
  static async getDashboardData(req: Request, res: Response, next: NextFunction) {
    try {
      // const { id } = req.param/s;
      // const data = await ManagerService.getRegisteredStudents();
      const data={}
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
  static async getApprovedStudents(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ManagerService.getApprovedStudents();
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async toggleStudentStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await ManagerService.toggleStudentStatus(id as string);
      res.status(200).json({ success: true, message: 'Student status toggled successfully.' });
    } catch (error) {
      next(error);
    }
  }

  static async updateStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = req.body;
      await ManagerService.updateStudent(id as string, data);
      res.status(200).json({ success: true, message: 'Student details updated successfully.' });
    } catch (error) {
      next(error);
    }
  }

  static async reEnrollStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = req.body;

      console.log('RE-ENROLL REQ USER:', (req as any).user);
      console.log('RE-ENROLL REQ USER ID:', (req as any).userId);

      const actorId = (req as any).user?.sub || (req as any).user?.id || (req as any).userId;

      if (!actorId) {
        throw new AppError('Unauthorized: Manager ID required for re-enrollment.', 401);
      }

      await ManagerService.reEnrollStudent(id as string, data, actorId);
      res.status(200).json({ success: true, message: 'Student re-enrolled successfully.' });
    } catch (error) {
      next(error);
    }
  }
}

export default ManagerController;
