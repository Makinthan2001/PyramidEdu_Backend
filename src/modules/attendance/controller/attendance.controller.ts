import { Request, Response, NextFunction } from 'express';
import { AttendanceService } from '../service/attendance.service';
import { AppError } from '../../../utils/AppError';

export class AttendanceController {
  static async markByQR(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, subjectId, sessionDate } = req.body;

      if (!token || !subjectId || !sessionDate) {
        throw new AppError('Token, subjectId, and sessionDate are required.', 400);
      }

      // `req.user` should be injected by the `authenticate` middleware
      const markedById = (req as any).user?.sub;

      if (!markedById) {
        throw new AppError('User authentication failed. Missing user ID.', 401);
      }

      const result = await AttendanceService.markAttendanceByQR(
        token,
        subjectId,
        sessionDate,
        markedById
      );

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
}
