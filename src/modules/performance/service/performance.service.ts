import prisma from '../../../config/prisma.config';
import { 
  DEFAULT_WEIGHTS, 
  PERFORMANCE_THRESHOLDS, 
  TREND_THRESHOLDS, 
  MISSED_EXAM_RATIO_THRESHOLD 
} from '../constants/performance.constants';
import { PerformanceLevel, TrendStatus } from '@prisma/client';

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

    // --- Calculate Metrics ---
    
    // Helper to calculate normalized average and missed counts
    const calculateExamMetrics = (submissions: any[], isManual = false) => {
      let totalNormalizedScore = 0;
      let validCount = 0;
      let missedCount = 0;

      for (const sub of submissions) {
        if (isManual) {
          if (sub.isAbsent) {
            missedCount++;
          } else if (sub.marksObtained != null && sub.manualExam?.totalMarks) {
            const normalized = (Number(sub.marksObtained) / sub.manualExam.totalMarks) * 100;
            totalNormalizedScore += normalized;
            validCount++;
          }
        } else {
          if (sub.submissionStatus === 'MISSED') {
            missedCount++;
          } else if (sub.totalScore != null && sub.exam?.totalMarks) {
            const normalized = (Number(sub.totalScore) / sub.exam.totalMarks) * 100;
            totalNormalizedScore += normalized;
            validCount++;
          }
        }
      }

      const average = validCount > 0 ? totalNormalizedScore / validCount : null;
      return { average, validCount, missedCount, totalAttemptedOrMissed: validCount + missedCount };
    };

    const mcqMetrics = calculateExamMetrics(mcqExams);
    const essayMetrics = calculateExamMetrics(essayExams);
    const manualMetrics = calculateExamMetrics(manualExams, true);

    // --- Weight Distribution ---
    let weights = { ...DEFAULT_WEIGHTS };
    let weightSum = 1;

    // Remove weight if completely 0 valid submissions (no data)
    if (mcqMetrics.validCount === 0) {
      weightSum -= weights.MCQ;
      weights.MCQ = 0;
    }
    if (essayMetrics.validCount === 0) {
      weightSum -= weights.ESSAY;
      weights.ESSAY = 0;
    }
    if (manualMetrics.validCount === 0) {
      weightSum -= weights.MANUAL_EXAM;
      weights.MANUAL_EXAM = 0;
    }
    
    // We assume attendance is always available.
    
    // Normalize weights
    if (weightSum > 0 && weightSum < 1) {
      weights.ATTENDANCE /= weightSum;
      weights.MCQ /= weightSum;
      weights.ESSAY /= weightSum;
      weights.MANUAL_EXAM /= weightSum;
    }

    // --- Final Score Calculation ---
    const finalScore = (
      (attendanceScore * weights.ATTENDANCE) +
      ((mcqMetrics.average || 0) * weights.MCQ) +
      ((essayMetrics.average || 0) * weights.ESSAY) +
      ((manualMetrics.average || 0) * weights.MANUAL_EXAM)
    );

    // --- Categorization ---
    let performanceLevel: PerformanceLevel = PerformanceLevel.AT_RISK;
    if (finalScore >= PERFORMANCE_THRESHOLDS.EXCELLENT) {
      performanceLevel = PerformanceLevel.EXCELLENT;
    } else if (finalScore >= PERFORMANCE_THRESHOLDS.VERY_GOOD) {
      performanceLevel = PerformanceLevel.VERY_GOOD;
    } else if (finalScore >= PERFORMANCE_THRESHOLDS.GOOD) {
      performanceLevel = PerformanceLevel.GOOD;
    } else if (finalScore >= PERFORMANCE_THRESHOLDS.AVERAGE) {
      performanceLevel = PerformanceLevel.AVERAGE;
    } else if (finalScore >= PERFORMANCE_THRESHOLDS.NEEDS_IMPROVEMENT) {
      performanceLevel = PerformanceLevel.NEEDS_IMPROVEMENT;
    }

    // --- Trend Calculation ---
    const previousPrediction = await prisma.performancePrediction.findFirst({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });

    let trendStatus: TrendStatus = TrendStatus.STABLE;
    if (previousPrediction) {
      const diff = finalScore - Number(previousPrediction.finalScore);
      if (diff >= TREND_THRESHOLDS.IMPROVING_MIN) {
        trendStatus = TrendStatus.IMPROVING;
      } else if (diff <= TREND_THRESHOLDS.DECLINING_MAX) {
        trendStatus = TrendStatus.DECLINING;
      }
    }

    // --- Recommendations ---
    const recommendations: string[] = [];
    if (attendanceScore < 70) {
      recommendations.push("Improve attendance");
    }
    if (mcqMetrics.validCount > 0 && mcqMetrics.average !== null && mcqMetrics.average < 55) {
      recommendations.push("Practice more MCQ questions");
    }
    if (essayMetrics.validCount > 0 && essayMetrics.average !== null && essayMetrics.average < 55) {
      recommendations.push("Improve essay writing skills");
    }
    if (manualMetrics.validCount > 0 && manualMetrics.average !== null && manualMetrics.average < 55) {
      recommendations.push("Focus on manual/physical exam preparation");
    }
    
    // Check missed exam ratios
    const totalMissedOnline = mcqMetrics.missedCount + essayMetrics.missedCount;
    const totalAttemptedOnline = mcqMetrics.totalAttemptedOrMissed + essayMetrics.totalAttemptedOrMissed;
    
    if (totalAttemptedOnline > 0 && (totalMissedOnline / totalAttemptedOnline) >= MISSED_EXAM_RATIO_THRESHOLD) {
      recommendations.push("Frequently absent for online exams — please follow up");
    }
    if (manualMetrics.totalAttemptedOrMissed > 0 && (manualMetrics.missedCount / manualMetrics.totalAttemptedOrMissed) >= MISSED_EXAM_RATIO_THRESHOLD) {
      recommendations.push("Frequently absent for physical exams — please follow up");
    }
    if (trendStatus === TrendStatus.DECLINING) {
      recommendations.push("Attend revision classes (declining trend detected)");
    }

    // --- Persistence ---
    return prisma.$transaction(async (tx) => {
      const prediction = await tx.performancePrediction.create({
        data: {
          studentId,
          attendanceScore,
          mcqScore: mcqMetrics.average || 0,
          essayScore: essayMetrics.average || 0,
          manualExamScore: manualMetrics.average || 0,
          finalScore,
          performanceLevel,
          trendStatus,
          recommendations,
          weightsUsed: weights,
          missedExamCount: totalMissedOnline,
          absentManualExamCount: manualMetrics.missedCount,
        }
      });

      await tx.student.update({
        where: { id: studentId },
        data: {
          performanceStatus: performanceLevel,
          trendStatus: trendStatus,
        }
      });

      return prediction;
    });
  }

  async calculatePerformanceForAll() {
    const students = await prisma.student.findMany({
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
        latestScore: latestPrediction?.finalScore || null,
        trendStatus: latestPrediction?.trendStatus || null,
      };
    }));

    return studentsWithScores;
  }
}
