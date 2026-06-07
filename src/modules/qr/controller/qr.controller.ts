import { Request, Response, NextFunction } from 'express';
import { QRService } from '../service/qr.service';

export class QRController {
  static async generateQR(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await QRService.generateStudentQR(req.params.studentId as string);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getStudentQR(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await QRService.getStudentQR(req.params.studentId as string);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
