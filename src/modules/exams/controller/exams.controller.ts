import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { examsService } from '../service/exams.service';
import prisma from '../../../config/prisma.config';
import { AppError } from '../../../utils/AppError';

async function resolveTeacherProfileId(userId: string, role: string): Promise<string> {
  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  if (!teacher) {
    if (role === 'TEACHER') {
      throw new AppError('Teacher profile not found', 404);
    }
    return userId;
  }
  return teacher.id;
}

export async function createExam(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as string;
    const userRole = (req as any).userRole as string;
    
    const teacher = await prisma.teacher.findUnique({
      where: { userId },
      include: { subjectAllocations: true }
    });
    
    if (!teacher && userRole === 'TEACHER') {
      throw new AppError('Teacher profile not found', 404);
    }
    
    const teacherId = teacher ? teacher.id : userId;
    
    if (userRole === 'TEACHER' && teacher) {
      const allowedSubjectIds = [
        teacher.subjectId,
        ...teacher.subjectAllocations
          .filter(sa => sa.status === 'ACTIVE')
          .map(sa => sa.subjectId)
      ].filter((id): id is string => !!id);
      
      if (!allowedSubjectIds.includes(req.body.subjectId)) {
        throw new AppError('You are not allowed to create exam for this subject', 403);
      }
    }

    const exam = await examsService.createExam(teacherId, req.body);
    res.status(201).json({ success: true, message: 'Exam created successfully', data: exam });
  } catch (error) {
    next(error);
  }
}

export async function getExams(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as string;
    const userRole = (req as any).userRole as string;
    const teacherId = await resolveTeacherProfileId(userId, userRole);
    const exams = await examsService.getExamsByTeacher(teacherId);
    res.status(200).json({ success: true, data: exams });
  } catch (error) {
    next(error);
  }
}

export async function getExamById(req: Request, res: Response, next: NextFunction) {
  try {
    const userRole = (req as any).userRole as Role;
    const userId = (req as any).userId as string;
    
    let teacherId: string | undefined;
    if (userRole === 'TEACHER') {
      teacherId = await resolveTeacherProfileId(userId, 'TEACHER');
    }
    
    const exam = await examsService.getExamById(req.params.id as string, teacherId);
    res.status(200).json({ success: true, data: exam });
  } catch (error) {
    next(error);
  }
}

export async function updateExam(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as string;
    const userRole = (req as any).userRole as string;
    const teacherId = await resolveTeacherProfileId(userId, userRole);
    const exam = await examsService.updateExam(req.params.id as string, teacherId, req.body);
    res.status(200).json({ success: true, message: 'Exam updated successfully', data: exam });
  } catch (error) {
    next(error);
  }
}

export async function deleteExam(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as string;
    const userRole = (req as any).userRole as string;
    const teacherId = await resolveTeacherProfileId(userId, userRole);
    await examsService.deleteExam(req.params.id as string, teacherId);
    res.status(200).json({ success: true, message: 'Exam deleted successfully' });
  } catch (error) {
    next(error);
  }
}

export async function addQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as string;
    const userRole = (req as any).userRole as string;
    const teacherId = await resolveTeacherProfileId(userId, userRole);
    const question = await examsService.addQuestion(req.params.id as string, teacherId, {
      ...req.body,
      examId: req.params.id as string,
    });
    res.status(201).json({ success: true, message: 'Question added successfully', data: question });
  } catch (error) {
    next(error);
  }
}

export async function deleteQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as string;
    const userRole = (req as any).userRole as string;
    const teacherId = await resolveTeacherProfileId(userId, userRole);
    await examsService.deleteQuestion(req.params.id as string, req.params.questionId as string, teacherId);
    res.status(200).json({ success: true, message: 'Question deleted successfully' });
  } catch (error) {
    next(error);
  }
}

export async function updateQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as string;
    const userRole = (req as any).userRole as string;
    const teacherId = await resolveTeacherProfileId(userId, userRole);
    const question = await examsService.updateQuestion(
      req.params.id as string,
      req.params.questionId as string,
      teacherId,
      req.body,
    );
    res.status(200).json({ success: true, message: 'Question updated successfully', data: question });
  } catch (error) {
    next(error);
  }
}

// STUDENT CONTROLLERS

export async function getStudentQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const actualStudentId = (req as any).studentId as string || (req as any).userId as string; 
    const questions = await examsService.getQuestionsForStudent(req.params.id as string, actualStudentId);
    res.status(200).json({ success: true, data: questions });
  } catch (error) {
    next(error);
  }
}

export async function submitExam(req: Request, res: Response, next: NextFunction) {
  try {
    const actualStudentId = (req as any).studentId as string || (req as any).userId as string;
    const submission = await examsService.submitExam(req.params.id as string, actualStudentId, req.body);
    res.status(201).json({ success: true, message: 'Exam submitted successfully', data: submission });
  } catch (error) {
    next(error);
  }
}

export async function getMyUpcomingExams(req: Request, res: Response, next: NextFunction) {
  try {
    const actualStudentId = (req as any).studentId as string || (req as any).userId as string;
    const exams = await examsService.getStudentUpcomingExams(actualStudentId);
    res.status(200).json({ success: true, data: exams });
  } catch (error) {
    next(error);
  }
}
