import { Request, Response, NextFunction } from 'express';
import { MobileFeeService } from '../service/fee.service';

export class MobileFeeController {
  static async getFeeHistory(req: Request, res: Response, next: NextFunction) {
    try {
      // Current user is attached by the auth middleware
      const userId = req.user!.sub;
      const data = await MobileFeeService.getFeeHistory(userId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async processPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.sub;
      const { amount, method } = req.body;
      const payment = await MobileFeeService.processPayment(userId, amount, method || 'CARD');
      res.status(200).json({ success: true, data: payment, message: 'Payment processed successfully.' });
    } catch (error) {
      next(error);
    }
  }
}
