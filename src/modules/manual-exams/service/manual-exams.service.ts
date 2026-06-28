import prisma from '../../../config/prisma.config';
import { CreateManualExamDto } from '../dto/create-manual-exam.dto';
import { SaveManualExamMarksDto } from '../dto/save-manual-exam-marks.dto';
import { AppError } from '../../../utils/AppError';

export class ManualExamsService {
  static async createManualExam(userId: string, data: CreateManualExamDto) {
    // Check if teacher exists and has a primary subject
    const teacher = await prisma.teacher.findFirst({
      where: { userId, deletedAt: null },
    });

    if (!teacher) {
      throw new AppError('Teacher not found', 404);
    }
    if (!teacher.subjectId) {
      throw new AppError('Teacher does not have an assigned subject', 400);
    }

    // Verify batch
    const batch = await prisma.batch.findUnique({
      where: { id: data.batchId },
    });

    if (!batch) {
      throw new AppError('Batch not found', 404);
    }

    const exam = await prisma.manualExam.create({
      data: {
        examTitle: data.examTitle,
        subjectId: teacher.subjectId,
        teacherId: teacher.id,
        batchId: data.batchId,
        totalMarks: data.totalMarks,
        examDate: new Date(data.examDate),
        duration: data.duration,
      },
      include: {
        subject: true,
        batch: true,
      },
    });

    return exam;
  }

  static async getAllManualExams(userId: string, search?: string) {
    const teacher = await prisma.teacher.findFirst({
      where: { userId, deletedAt: null },
    });

    if (!teacher) {
      throw new AppError('Teacher not found', 404);
    }

    const whereClause: any = {
      teacherId: teacher.id,
    };

    if (search) {
      whereClause.examTitle = {
        contains: search,
        mode: 'insensitive',
      };
    }

    const exams = await prisma.manualExam.findMany({
      where: whereClause,
      include: {
        subject: true,
        batch: {
          include: {
            _count: {
              select: { students: true },
            },
          },
        },
        _count: {
          select: { marks: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return exams;
  }

  static async getManualExamById(userId: string, id: string) {
    const teacher = await prisma.teacher.findFirst({
      where: { userId, deletedAt: null },
    });

    if (!teacher) {
      throw new AppError('Teacher not found', 404);
    }

    const exam = await prisma.manualExam.findUnique({
      where: { id },
      include: {
        subject: true,
        batch: true,
      },
    });

    if (!exam || exam.teacherId !== teacher.id) {
      throw new AppError('Manual exam not found', 404);
    }

    return exam;
  }

  static async getStudentsForManualExam(userId: string, examId: string) {
    const exam = await this.getManualExamById(userId, examId);

    const students = await prisma.student.findMany({
      where: {
        batchId: exam.batchId,
      },
      include: {
        user: true,
        manualExamMarks: {
          where: {
            manualExamId: examId,
          },
        },
      },
      orderBy: {
        user: { fullName: 'asc' },
      },
    });

    return students.map((student) => {
      const mark = student.manualExamMarks[0];
      return {
        id: student.id,
        fullName: student.user.fullName,
        indexNumber: student.indexNumber,
        nic: student.nic,
        marksObtained: mark && mark.marksObtained !== null ? Number(mark.marksObtained) : null,
        isAbsent: mark ? mark.isAbsent : false,
      };
    });
  }

  static async saveMarks(userId: string, examId: string, data: SaveManualExamMarksDto) {
    const exam = await this.getManualExamById(userId, examId);

    // Validate marks
    for (const mark of data.marks) {
      if (!mark.isAbsent) {
        if (mark.marksObtained === undefined || mark.marksObtained === null) {
          throw new AppError(`Marks must be provided if the student is not absent`, 400);
        }
        if (mark.marksObtained > exam.totalMarks) {
          throw new AppError(`Marks obtained cannot exceed total marks (${exam.totalMarks})`, 400);
        }
        if (mark.marksObtained < 0) {
          throw new AppError(`Marks cannot be negative`, 400);
        }
      }
    }

    // Upsert marks using transaction
    const transaction = data.marks.map((mark) => {
      return prisma.manualExamMark.upsert({
        where: {
          manualExamId_studentId: {
            manualExamId: examId,
            studentId: mark.studentId,
          },
        },
        update: {
          marksObtained: mark.isAbsent ? null : mark.marksObtained,
          isAbsent: mark.isAbsent ?? false,
        },
        create: {
          manualExamId: examId,
          studentId: mark.studentId,
          marksObtained: mark.isAbsent ? null : mark.marksObtained ?? 0, // Fallback to 0 if null, though validation catches this
          isAbsent: mark.isAbsent ?? false,
        },
      });
    });

    await prisma.$transaction(transaction);

    return { message: 'Marks saved successfully' };
  }
}
