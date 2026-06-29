import { Request, Response, NextFunction } from 'express';
import { ParentReportsService } from '../service/parent-reports.service';
import { AppError } from '../../../utils/AppError';
import prisma from '../../../config/prisma.config';

export class ParentReportsController {
  static async generate(req: Request, res: Response, next: NextFunction) {
    try {
      const { month, year } = req.body;
      if (!month || !year) {
        throw new AppError('Month and year are required fields.', 400);
      }

      // Check if reports for this month and year have already been generated
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);
      
      const existingCount = await prisma.parentReport.count({
        where: {
          generatedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      if (existingCount > 0) {
        throw new AppError('Reports for this month and year have already been generated.', 409);
      }

      const results = await ParentReportsService.generateMonthlyReports(Number(month), Number(year), 'MANUAL');
      
      res.status(200).json({
        success: true,
        message: `Successfully processed parent reports generation.`,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { month, year } = req.query;
      if (!month || !year) {
        throw new AppError('Month and year query parameters are required.', 400);
      }

      const reports = await ParentReportsService.getAllReports(Number(month), Number(year));

      res.status(200).json({
        success: true,
        data: reports,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStudentReports(req: Request, res: Response, next: NextFunction) {
    try {
      let studentId = req.params.studentId as string;
      if (!studentId) {
        throw new AppError('Student ID is a required parameter.', 400);
      }

      if (studentId === 'me') {
        const userId = req.user!.sub;
        const student = await prisma.student.findUnique({
          where: { userId },
        });
        if (!student) {
          throw new AppError('Student profile not found.', 404);
        }
        studentId = student.id;
      }

      const reports = await ParentReportsService.getStudentReports(studentId);

      res.status(200).json({
        success: true,
        data: reports,
      });
    } catch (error) {
      next(error);
    }
  }
}
