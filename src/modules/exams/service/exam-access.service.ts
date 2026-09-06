import prisma from '../../../config/prisma.config';
import { AppError } from '../../../utils/AppError';
import { EnrollmentStatus, FeeStatus } from '@prisma/client';

export class ExamAccessService {
  /**
   * Validates if a student can access or submit an exam.
   * Throws ApiError if validation fails.
   */
  async validateStudentAccess(examId: string, studentId: string): Promise<void> {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { subject: true },
    });

    if (!exam) {
      throw new AppError('Exam not found', 404);
    }

    if (!exam.isPublished) {
      throw new AppError('Exam is not currently available', 403);
    }

    const now = new Date();
    
    // Time validation
    if (exam.startTime && now < exam.startTime) {
      throw new AppError('Exam has not started yet', 403);
    }

    if (exam.startTime && exam.duration) {
      const lateTimeMinutes = (exam as any).lateExamAvailableTime || 0;
      const endTime = new Date(exam.startTime.getTime() + (exam.duration + lateTimeMinutes) * 60000);
      if (now > endTime) {
        throw new AppError('Exam has already ended and the late submission period is over', 403);
      }
    }

    // Enrollment validation
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId,
        subjectId: exam.subjectId,
      },
    });

    if (!enrollment || enrollment.enrollmentStatus !== EnrollmentStatus.ACTIVE) {
      throw new AppError('You must be actively enrolled in this subject to take the exam', 403);
    }

    // Fee policy validation (3-month unpaid fee restriction)
    const { FeePolicyService } = await import('../../payments/service/fee-policy.service');
    const feeStatus = await FeePolicyService.getStudentUnpaidFeeDetails(studentId);
    if (feeStatus.isRestricted) {
      // Trigger manager alert and parent email dispatch
      await FeePolicyService.enforceThreeMonthPolicy(studentId);
      throw new AppError(
        `Exam access restricted due to ${feeStatus.unpaidCount} unpaid fee months. Please settle outstanding fees of Rs. ${feeStatus.totalOutstanding.toLocaleString()}.`,
        403
      );
    }

    // Duplicate submission check
    const existingSubmission = await prisma.examSubmission.findUnique({
      where: {
        examId_studentId: {
          examId,
          studentId,
        },
      },
    });

    if (existingSubmission) {
      throw new AppError('You have already submitted this exam', 409);
    }
  }
}

export const examAccessService = new ExamAccessService();
