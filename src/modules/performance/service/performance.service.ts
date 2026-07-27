import prisma from '../../../config/prisma.config';
import { calculatePerformanceResult } from '../utils/performance.calculator';

export class PerformanceService {

  private async getStudentByIdOrIndex(identifier: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
    return await prisma.student.findFirst({
      where: isUuid ? { id: identifier } : { indexNumber: identifier },
    });
  }

  private async verifyTeacherAccess(studentId: string, user: any) {
    if (user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findUnique({ where: { userId: user.sub } });
      if (!teacher) throw new Error('Teacher record not found for this user.');
      
      const enrollment = await prisma.enrollment.findFirst({
        where: { studentId, teacherId: teacher.id }
      });
      
      if (!enrollment) {
        throw new Error('Access denied: Student is not enrolled in your classes.');
      }
    }
  }

  async calculatePerformanceForStudent(studentIdOrIndex: string, user: any) {
    const student = await this.getStudentByIdOrIndex(studentIdOrIndex);

    if (!student) {
      throw new Error(`Student with ID ${studentIdOrIndex} not found.`);
    }

    const studentId = student.id;
    await this.verifyTeacherAccess(studentId, user);

    // 1. Attendance Data
    const attendanceScore = Number(student.attendancePercentage) || 0;

    // 2. MCQ Data
    const mcqExams = await prisma.examSubmission.findMany({
      where: {
        studentId,
        exam: { examType: 'MCQ' },
      },
      include: { exam: true },
    });

    // 3. Essay Data
    const essayExams = await prisma.examSubmission.findMany({
      where: {
        studentId,
        exam: { examType: 'ESSAY' },
      },
      include: { exam: true },
    });

    // 4. Manual Exam Data
    const manualExams = await prisma.manualExamMark.findMany({
      where: { studentId },
      include: { manualExam: true },
    });

    const previousPrediction = await prisma.performancePrediction.findFirst({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });

    const calcResult = calculatePerformanceResult({
      attendanceScore,
      mcqExams: mcqExams.map(m => ({ ...m, totalScore: m.totalScore ? Number(m.totalScore) : null })),
      essayExams: essayExams.map(m => ({ ...m, totalScore: m.totalScore ? Number(m.totalScore) : null })),
      manualExams,
      previousFinalScore: previousPrediction ? Number(previousPrediction.finalScore) : null,
    });

    // --- Persistence ---
    return prisma.$transaction(async (tx) => {
      const prediction = await tx.performancePrediction.create({
        data: {
          studentId,
          attendanceScore,
          mcqScore: calcResult.mcqMetrics.average || 0,
          essayScore: calcResult.essayMetrics.average || 0,
          manualExamScore: calcResult.manualMetrics.average || 0,
          finalScore: calcResult.finalScore,
          performanceLevel: calcResult.performanceLevel,
          trendStatus: calcResult.trendStatus,
          recommendations: calcResult.recommendations,
          weightsUsed: calcResult.weights,
          missedExamCount: calcResult.totalMissedOnline,
          absentManualExamCount: calcResult.totalMissedManual,
        }
      });

      await tx.student.update({
        where: { id: studentId },
        data: {
          performanceStatus: calcResult.performanceLevel,
          trendStatus: calcResult.trendStatus,
        }
      });

      return prediction;
    });
  }

  async calculatePerformanceForAll(studentIds?: string[]) {
    const students = await prisma.student.findMany({
      where: studentIds ? { id: { in: studentIds } } : undefined,
      select: { id: true },
    });

    const results = [];
    for (const student of students) {
      try {
        // user is not passed here because this is an internal manager/admin process
        // to bypass the check, we can pass a dummy manager user or just let it pass
        const result = await this.calculatePerformanceForStudent(student.id, { role: 'MANAGER' });
        results.push({ studentId: student.id, status: 'success', predictionId: result.id });
      } catch (error: any) {
        console.error(`Failed to calculate performance for student ${student.id}`, error.stack);
        results.push({ studentId: student.id, status: 'failed', error: error.message });
      }
    }
    return results;
  }

  async getStudentPerformanceHistory(studentIdOrIndex: string, user: any) {
    const studentTarget = await this.getStudentByIdOrIndex(studentIdOrIndex);
    if (!studentTarget) {
      throw new Error(`Student with ID ${studentIdOrIndex} not found.`);
    }
    const studentId = studentTarget.id;

    // If it's a student, ensure they can only query their own history
    if (user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({ where: { userId: user.sub } });
      if (!student || student.id !== studentId) {
        throw new Error('Access denied: You can only view your own performance history.');
      }
    } else {
      await this.verifyTeacherAccess(studentId, user);
    }

    return await prisma.performancePrediction.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPerformanceStudentsList(user: any) {
    let studentIds: string[] | undefined;

    // If TEACHER, filter only to their enrolled students
    if (user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findUnique({ where: { userId: user.sub } });
      if (!teacher) throw new Error('Teacher record not found for this user.');
      
      const enrollments = await prisma.enrollment.findMany({
        where: { teacherId: teacher.id, enrollmentStatus: 'ACTIVE' },
        select: { studentId: true }
      });
      studentIds = enrollments.map(e => e.studentId);
    }

    const students = await prisma.student.findMany({
      where: studentIds ? { id: { in: studentIds } } : undefined,
      select: {
        id: true,
        indexNumber: true,
        performanceStatus: true,
        batchId: true,
        rewardPoints: true,
        dailyStreak: true,
        batchRecord: { select: { batchName: true } },
        user: { select: { fullName: true } }
      }
    });

    const studentsWithScores = await Promise.all(students.map(async (student) => {
      const latestPrediction = await prisma.performancePrediction.findFirst({
        where: { studentId: student.id },
        orderBy: { createdAt: 'desc' },
        select: { finalScore: true, trendStatus: true }
      });

      return {
        id: student.id,
        indexNumber: student.indexNumber,
        fullName: student.user.fullName,
        performanceStatus: student.performanceStatus,
        batchId: student.batchId,
        batchName: student.batchRecord?.batchName || 'No Batch',
        latestScore: latestPrediction?.finalScore || null,
        trendStatus: latestPrediction?.trendStatus || null,
        rewardPoints: student.rewardPoints,
        dailyStreak: student.dailyStreak,
      };
    }));

    return studentsWithScores;
  }
}
