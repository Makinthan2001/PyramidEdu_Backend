import { Request, Response, NextFunction } from 'express';
import { AttendanceService } from '../service/attendance.service';
import { AppError } from '../../../utils/AppError';
import prisma from '../../../config/prisma.config';

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

  static async createSession(req: Request, res: Response, next: NextFunction) {
    try {
      const { subjectId, teacherId, batchId, sessionDate, sessionTime } = req.body;
      if (!subjectId || !teacherId || !sessionDate || !sessionTime) {
        throw new AppError('subjectId, teacherId, sessionDate, sessionTime are required.', 400);
      }
      const createdById = (req as any).user?.sub;
      if (!createdById) throw new AppError('User authentication failed.', 401);

      const session = await AttendanceService.createSession({
        subjectId, teacherId, batchId, sessionDate, sessionTime, createdById
      });

      res.status(201).json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }

  static async fetchSession(req: Request, res: Response, next: NextFunction) {
    try {
      const { subjectId, teacherId, batchId, sessionDate, sessionTime } = req.query;

      if (!sessionDate) {
        throw new AppError('sessionDate is required.', 400);
      }

      if (sessionDate && !subjectId && !teacherId && !sessionTime) {
        // Fetch all sessions for the date
        const sessions = await AttendanceService.fetchSessionsByDate(sessionDate as string);
        return res.status(200).json({ success: true, data: sessions });
      }

      if (!subjectId || !teacherId || !sessionTime) {
        throw new AppError('subjectId, teacherId, sessionTime are required for fetching a specific session.', 400);
      }

      const session = await AttendanceService.fetchSession(
        subjectId as string,
        teacherId as string,
        sessionDate as string,
        sessionTime as string,
        batchId as string | undefined
      );

      res.status(200).json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }

  static async startSession(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const session = await AttendanceService.startSession(id as string);
      res.status(200).json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }

  static async endSession(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await AttendanceService.endSession(id as string);
      res.status(200).json({ success: true, data: result });
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

  static async getManagerSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string;

      const result = await AttendanceService.getManagerAttendanceSummary(page, limit, search);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  static async getManagerStudentDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId } = req.params;
      const filters = {
        fromDate: req.query.fromDate as string,
        toDate: req.query.toDate as string,
        subjectId: req.query.subjectId as string,
      };

      const result = await AttendanceService.getManagerStudentDetails(studentId as string, filters);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      require('fs').appendFileSync('error.log', String(error?.stack || error) + '\n');
      next(error);
    }
  }

  static async getTeacherSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.sub;
      if (!userId) {
        throw new AppError('User authentication failed. Missing user ID.', 401);
      }

      // Find the teacher ID from the user ID
      const teacher = await prisma.teacher.findUnique({ where: { userId } });
      if (!teacher) {
        throw new AppError('Teacher profile not found.', 404);
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string;

      const result = await AttendanceService.getTeacherAttendanceSummary(teacher.id, page, limit, search);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  static async getTeacherStudentDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.sub;
      if (!userId) {
        throw new AppError('User authentication failed. Missing user ID.', 401);
      }

      const teacher = await prisma.teacher.findUnique({ where: { userId } });
      if (!teacher) {
        throw new AppError('Teacher profile not found.', 404);
      }

      const { studentId } = req.params;
      const filters = {
        fromDate: req.query.fromDate as string,
        toDate: req.query.toDate as string,
      };

      const result = await AttendanceService.getTeacherStudentDetails(teacher.id, studentId as string, filters);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
