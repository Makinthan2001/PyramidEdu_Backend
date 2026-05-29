import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import SubjectsService from '../service/subjects.service';
import type { CreateSubjectDto } from '../dto/create-subject.dto';
import type { CreateStreamDto } from '../dto/create-stream.dto';
import type { UpdateSubjectDto } from '../dto/update-subject.dto';
import type { EnrollStudentDto } from '../dto/enroll-student.dto';

function parseBoolean(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value === 'true' || value === true) {
    return true;
  }

  if (value === 'false' || value === false) {
    return false;
  }

  return undefined;
}

export async function getSubjects(req: Request, res: Response, next: NextFunction) {
  try {
    const userRole = (req as any).userRole as UserRole | undefined;
    const userId = (req as any).userId as number | undefined;

    const result = await SubjectsService.getSubjects({
      active: parseBoolean(req.query.active),
      teacherId: req.query.teacherId ? Number(req.query.teacherId) : undefined,
      search: (req.query.search as string) || undefined,
      userRole,
      userId,
    });

    res.status(200).json({
      success: true,
      message: 'Subjects retrieved successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getStreams(req: Request, res: Response, next: NextFunction) {
  try {
    const streams = await SubjectsService.getStreams();

    res.status(200).json({
      success: true,
      message: 'Streams retrieved successfully',
      data: streams,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAvailableSubjects(req: Request, res: Response, next: NextFunction) {
  try {
    const subjects = await SubjectsService.getAvailableSubjects();

    res.status(200).json({
      success: true,
      message: 'Available subjects retrieved successfully',
      data: subjects,
    });
  } catch (error) {
    next(error);
  }
}

export async function createStream(req: Request, res: Response, next: NextFunction) {
  try {
    const dto: CreateStreamDto = req.body;
    const userId = (req as any).userId as number | undefined;

    const stream = await SubjectsService.createStream(dto, { userId });

    res.status(201).json({
      success: true,
      message: 'Stream created successfully',
      data: stream,
    });
  } catch (error) {
    next(error);
  }
}

export async function getSubjectById(req: Request, res: Response, next: NextFunction) {
  try {
    const identifier = String(req.params.id);
    const userRole = (req as any).userRole as UserRole | undefined;
    const userId = (req as any).userId as number | undefined;

    const subject = await SubjectsService.getSubjectByIdentifier(identifier, {
      userRole,
      userId,
    });

    res.status(200).json({
      success: true,
      message: 'Subject retrieved successfully',
      data: subject,
    });
  } catch (error) {
    next(error);
  }
}

export async function createSubject(req: Request, res: Response, next: NextFunction) {
  try {
    const dto: CreateSubjectDto = req.body;
    const userId = (req as any).userId as number | undefined;

    const subject = await SubjectsService.createSubject(dto, { userId });

    res.status(201).json({
      success: true,
      message: 'Subject created successfully',
      data: subject,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateSubject(req: Request, res: Response, next: NextFunction) {
  try {
    const subjectId = Number(req.params.id);
    const dto: UpdateSubjectDto = req.body;
    const userId = (req as any).userId as number | undefined;

    const subject = await SubjectsService.updateSubject(subjectId, dto, { userId });

    res.status(200).json({
      success: true,
      message: 'Subject updated successfully',
      data: subject,
    });
  } catch (error) {
    next(error);
  }
}

export async function deactivateSubject(req: Request, res: Response, next: NextFunction) {
  try {
    const subjectId = Number(req.params.id);
    const userId = (req as any).userId as number | undefined;
    const userRole = (req as any).userRole as UserRole | undefined;
    const force = userRole === UserRole.ADMIN && parseBoolean(req.query.force) === true;

    const subject = await SubjectsService.deactivateSubject(subjectId, {
      userId,
      force,
    });

    res.status(200).json({
      success: true,
      message: 'Subject deactivated successfully',
      data: subject,
    });
  } catch (error) {
    next(error);
  }
}

export async function assignTeacher(req: Request, res: Response, next: NextFunction) {
  try {
    const subjectId = Number(req.params.id);
    const teacherId = Number(req.body.teacherId);
    const userId = (req as any).userId as number | undefined;

    const subject = await SubjectsService.assignTeacher(subjectId, teacherId, { userId });

    res.status(200).json({
      success: true,
      message: 'Teacher assigned successfully',
      data: subject,
    });
  } catch (error) {
    next(error);
  }
}

export async function getSubjectStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const subjectId = Number(req.params.id);
    const userRole = (req as any).userRole as UserRole | undefined;
    const userId = (req as any).userId as number | undefined;

    const result = await SubjectsService.getSubjectStudents(subjectId, {
      userRole,
      userId,
    });

    res.status(200).json({
      success: true,
      message: 'Subject students retrieved successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function enrollStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const subjectId = Number(req.params.id);
    const dto: EnrollStudentDto = req.body;
    const userRole = (req as any).userRole as UserRole | undefined;
    const userId = (req as any).userId as number | undefined;

    const enrollment = await SubjectsService.enrollStudent(subjectId, dto, {
      userRole,
      userId,
    });

    res.status(201).json({
      success: true,
      message: 'Student enrolled successfully',
      data: enrollment,
    });
  } catch (error) {
    next(error);
  }
}

export async function unenrollStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const subjectId = Number(req.params.id);
    const studentId = Number(req.params.sid);
    const userRole = (req as any).userRole as UserRole | undefined;
    const userId = (req as any).userId as number | undefined;

    const enrollment = await SubjectsService.unenrollStudent(subjectId, studentId, {
      userRole,
      userId,
    });

    res.status(200).json({
      success: true,
      message: 'Student unenrolled successfully',
      data: enrollment,
    });
  } catch (error) {
    next(error);
  }
}

export async function getEnrollmentCount(req: Request, res: Response, next: NextFunction) {
  try {
    const subjectId = Number(req.params.id);

    const count = await SubjectsService.getEnrollmentCount(subjectId);

    res.status(200).json({
      success: true,
      message: 'Enrollment count retrieved successfully',
      data: { subjectId, enrollmentCount: count },
    });
  } catch (error) {
    next(error);
  }
}

export default {
  getAvailableSubjects,
  getStreams,
  createStream,
  getSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deactivateSubject,
  assignTeacher,
  getSubjectStudents,
  enrollStudent,
  unenrollStudent,
  getEnrollmentCount,
};