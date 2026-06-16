import { Request, Response, NextFunction } from 'express';
import { TeacherStudentsService } from '../service/teacher-students.service';

/**
 * GET /api/v1/teachers/me/students
 * List students assigned to the logged-in teacher with search and pagination
 */
export async function getMyStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string | undefined;

    const result = await TeacherStudentsService.getTeacherStudents(userId, {
      page,
      limit,
      search,
    });

    res.status(200).json({
      success: true,
      message: 'Assigned students retrieved successfully',
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/teachers/me/students/:studentId
 * Get detailed profile information for a specific assigned student
 */
export async function getMyStudentById(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as string;
    const studentId = req.params.studentId as string;

    const result = await TeacherStudentsService.getTeacherStudentById(userId, studentId);

    res.status(200).json({
      success: true,
      message: 'Student details retrieved successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
