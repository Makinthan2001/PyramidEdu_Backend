import { Request, Response, NextFunction } from 'express';

import TeachersService from '../service/teachers.service';
import { CreateTeacherDto, UpdateTeacherDto, AssignSubjectDto } from '../dto/index';

/**
 * GET /api/v1/teachers
 * List teachers with pagination and optional filters
 */
export async function getTeachers(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string | undefined;
    const specialization = req.query.specialization as string | undefined;

    const result = await TeachersService.getTeachers({ page, limit, search, specialization });
    res.status(200).json({ success: true, message: 'Teachers retrieved', data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/teachers/:id
 * Retrieve a single teacher by ID
 */
export async function getTeacherById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const teacher = await TeachersService.getTeacherById(id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }
    res.status(200).json({ success: true, message: 'Teacher retrieved', data: teacher });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/teachers
 * Create a new teacher profile (admin only)
 */
export async function createTeacher(req: Request, res: Response, next: NextFunction) {
  try {
    const dto: CreateTeacherDto = req.body;
    const teacher = await TeachersService.createTeacher(dto);
    res.status(201).json({ success: true, message: 'Teacher created', data: teacher });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/teachers/:id
 * Update teacher details (admin/manager)
 */
export async function updateTeacher(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const dto: UpdateTeacherDto = req.body;
    const teacher = await TeachersService.updateTeacher(id, dto);
    res.status(200).json({ success: true, message: 'Teacher updated', data: teacher });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/teachers/:id
 * Soft‑delete teacher (admin only)
 */
export async function deleteTeacher(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const teacher = await TeachersService.deleteTeacher(id);
    res.status(200).json({ success: true, message: 'Teacher deleted (soft)', data: teacher });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/teachers/me
 * Return the logged‑in teacher's own profile
 */
export async function getMyProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const teacherId = (req as any).teacherId as number; // set by auth middleware
    const teacher = await TeachersService.getTeacherById(teacherId);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }
    res.status(200).json({ success: true, message: 'Profile retrieved', data: teacher });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/teachers/me
 * Update basic own details (teacher role)
 */
export async function updateMyProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const teacherId = (req as any).teacherId as number;
    const dto: UpdateTeacherDto = req.body;
    const teacher = await TeachersService.updateTeacher(teacherId, dto);
    res.status(200).json({ success: true, message: 'Profile updated', data: teacher });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/teachers/:id/subjects
 * List subjects assigned to a teacher
 */
export async function getTeacherSubjects(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const teacher = await TeachersService.getTeacherById(id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }
    const subjects = teacher.subjects ?? [];
    res.status(200).json({ success: true, message: 'Subjects retrieved', data: subjects });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/teachers/:id/salary
 * Update teacher salary (admin only)
 */
export async function updateSalary(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const { salary } = req.body as { salary?: number };
    const teacher = await TeachersService.updateTeacher(id, { salary } as any);
    res.status(200).json({ success: true, message: 'Salary updated', data: teacher });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/teachers/:id/subjects
 * Assign a subject to a teacher
 */
export async function assignSubject(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const dto: AssignSubjectDto = req.body;
    await TeachersService.assignSubject(id, dto);
    res.status(200).json({ success: true, message: 'Subject assigned' });
  } catch (error) {
    next(error);
  }
}

export default {
  getTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  getMyProfile,
  updateMyProfile,
  getTeacherSubjects,
  updateSalary,
  assignSubject,
};
