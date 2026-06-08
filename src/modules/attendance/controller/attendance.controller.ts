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

  static async getStudents(req: Request, res: Response, next: NextFunction) {
    try {
      const { subjectId, batchId, teacherId, sessionDate, sessionTime } = req.query;

      if (!subjectId || !sessionDate || !sessionTime) {
        throw new AppError('subjectId, sessionDate, and sessionTime are required parameters.', 400);
      }

      const students = await AttendanceService.getStudentsForAttendance(
        subjectId as string,
        batchId as string | undefined,
        teacherId as string | undefined,
        sessionDate as string,
        sessionTime as string
      );

      res.status(200).json({
        success: true,
        data: students,
      });
    } catch (error) {
      next(error);
    }
  }

  static async markManual(req: Request, res: Response, next: NextFunction) {
    try {
      const { records } = req.body;

      if (!records || !Array.isArray(records) || records.length === 0) {
        throw new AppError('An array of attendance records is required.', 400);
      }

      // `req.user` injected by authenticate middleware
      const markedById = (req as any).user?.sub;

      if (!markedById) {
        throw new AppError('User authentication failed. Missing user ID.', 401);
      }

      const results = await AttendanceService.markManualAttendance(records, markedById);

      res.status(201).json({
        success: true,
        message: 'Attendance saved successfully.',
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }
}
