import prisma from '../../../config/prisma.config';
import { notificationService } from '../../notification/service/notification.service';
import { AppError } from '../../../utils/AppError';
import { CreateExamDto } from '../dto/create-exam.dto';
import { UpdateExamDto } from '../dto/update-exam.dto';
import { CreateQuestionDto } from '../dto/create-question.dto';
import { SubmitExamDto } from '../dto/submit-exam.dto';
import { examAccessService } from './exam-access.service';
import { gradingService } from './grading.service';
import { NotificationService } from '../../mobile/notification/notification.service';

export class ExamsService {
  async createExam(teacherId: string, data: CreateExamDto) {
    const exam = await prisma.exam.create({
      data: {
        ...data,
        teacherId,
      },
    });

    if (exam.isPublished) {
      await this.notifyEligibleStudents(exam.id);
    }

    return exam;
  }

  async getExamsByTeacher(teacherId: string) {
    return await prisma.exam.findMany({
      where: { teacherId },
      include: {
        subject: { select: { subjectName: true, subjectCode: true } },
        batchRecord: { select: { batchName: true } },
        term: { select: { name: true } },
        _count: { select: { questions: true, submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getExamById(examId: string, teacherId?: string) {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
        subject: { select: { subjectName: true, subjectCode: true } },
        batchRecord: { select: { batchName: true } },
        term: { select: { name: true } },
        _count: { select: { submissions: true } },
      },
    });

    if (!exam) throw new AppError('Exam not found', 404);
    if (teacherId && exam.teacherId !== teacherId) {
      throw new AppError('Unauthorized access to exam', 403);
    }

    return exam;
  }

  async getExamSubmissions(examId: string, teacherId: string) {
    await this.getExamById(examId, teacherId);

    return await prisma.examSubmission.findMany({
      where: { examId },
      include: {
        student: {
          include: {
            user: {
              select: {
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async updateExam(examId: string, teacherId: string, data: UpdateExamDto) {
    const exam = await this.getExamById(examId, teacherId);
    const wasPublished = exam.isPublished;

    // if (exam.isPublished && exam.startTime && new Date() >= exam.startTime) {
    //   throw new AppError('Cannot update exam after it has started', 400);
    // }

    const updatedExam = await prisma.exam.update({
      where: { id: examId },
      data,
    });

    if (updatedExam.isPublished && !wasPublished) {
      await this.notifyEligibleStudents(updatedExam.id);
    }

    return updatedExam;
  }

  async deleteExam(examId: string, teacherId: string) {
    const exam = await this.getExamById(examId, teacherId);

    // if (exam.startTime && new Date() >= exam.startTime) {
    //   throw new AppError('Cannot delete exam after it has started', 400);
    // }

    await prisma.exam.delete({
      where: { id: examId },
    });
  }

  async addQuestion(examId: string, teacherId: string, data: CreateQuestionDto) {
    const exam = await this.getExamById(examId, teacherId);

    // if (exam.isPublished && exam.startTime && new Date() >= exam.startTime) {
    //   throw new AppError('Cannot add questions after exam has started', 400);
    // }

    return await prisma.question.create({
      data: {
        examId,
        questionText: data.questionText || null,
        imageUrl: data.imageUrl || null,
        questionType: data.questionType,
        marks: data.marks,
        options: data.options ? (data.options as any) : undefined,
        correctAnswer: data.correctAnswer || undefined,
        explanation: data.explanation || null,
        order: data.order,
      },
    });
  }

  async deleteQuestion(examId: string, questionId: string, teacherId: string) {
    const exam = await this.getExamById(examId, teacherId);

    // if (exam.isPublished && exam.startTime && new Date() >= exam.startTime) {
    //   throw new AppError('Cannot delete questions after exam has started', 400);
    // }

    await prisma.question.delete({
      where: { id: questionId },
    });
  }

  async updateQuestion(examId: string, questionId: string, teacherId: string, data: Partial<CreateQuestionDto>) {
    const exam = await this.getExamById(examId, teacherId);

    // if (exam.isPublished && exam.startTime && new Date() >= exam.startTime) {
    //   throw new AppError('Cannot edit questions after exam has started', 400);
    // }

    return await prisma.question.update({
      where: { id: questionId },
      data: {
        questionText: data.questionText !== undefined ? data.questionText : undefined,
        imageUrl: data.imageUrl !== undefined ? data.imageUrl : undefined,
        questionType: data.questionType,
        marks: data.marks,
        options: data.options ? (data.options as any) : undefined,
        correctAnswer: data.correctAnswer || undefined,
        explanation: data.explanation !== undefined ? data.explanation : undefined,
        order: data.order,
      },
    });
  }

  // STUDENT ENDPOINTS

  async getQuestionsForStudent(examId: string, studentId: string) {
    await examAccessService.validateStudentAccess(examId, studentId);

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!exam) throw new AppError('Exam not found', 404);

    // Strip correctAnswer before sending to student!
    const secureQuestions = exam.questions.map((q) => {
      const { correctAnswer, ...safeQuestion } = q;
      return safeQuestion;
    });

    return secureQuestions;
  }

  async submitExam(examId: string, studentId: string, data: SubmitExamDto) {
    await examAccessService.validateStudentAccess(examId, studentId);

    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new AppError('Exam not found', 404);

    const existingSubmission = await prisma.examSubmission.findUnique({
      where: {
        examId_studentId: {
          examId,
          studentId,
        },
      },
    });

    if (existingSubmission) {
      throw new AppError('You have already submitted this exam.', 400);
    }

    const gradingResult = await gradingService.gradeSubmission(examId, studentId, data.answers || {});

    // Calculate submissionStatus and attendanceStatus
    const now = new Date();
    let submissionStatus = 'SUBMITTED';
    let attendanceStatus: 'PRESENT' | 'LATE' | 'ABSENT' = 'PRESENT';
    if (exam.startTime && exam.duration) {
      const endTime = new Date(exam.startTime.getTime() + exam.duration * 60000);
      if (now > endTime) {
        submissionStatus = 'LATE_SUBMISSION';
        attendanceStatus = 'LATE';
      }
    }

    const finalStatus = exam.examType === 'ESSAY' ? 'PENDING_MANUAL' : gradingResult.status;
    const finalScore = exam.examType === 'ESSAY' ? 0 : gradingResult.totalScore;
    const finalMarks = exam.examType === 'ESSAY' ? 0 : gradingResult.percentage;
    const finalGrade = exam.examType === 'ESSAY' ? null : gradingResult.gradeLetter;
    const finalFeedback = exam.examType === 'ESSAY' ? 'Pending manual grading.' : `Auto-graded: ${gradingResult.totalScore}/${exam.totalMarks} marks.`;

    // Create Submission, Answers, and Result in a transaction
    const submissionRecord = await prisma.$transaction(async (tx) => {
      const submission = await tx.examSubmission.create({
        data: {
          examId,
          studentId,
          totalScore: finalScore,
          status: finalStatus,
          submissionStatus,
          attendanceStatus,
          answerPdfUrl: data.answerPdfUrl,
          answerPdfPublicId: data.answerPdfPublicId,
          answers: {
            createMany: {
              data: gradingResult.answerRecords,
            },
          },
        },
      });

      await tx.result.create({
        data: {
          studentId,
          subjectId: exam.subjectId,
          examId: exam.id,
          marks: finalMarks,
          grade: finalGrade,
          feedback: finalFeedback,
        },
      });

      return submission;
    });

    try {
      if (exam.examType !== 'ESSAY') {
        const { NotificationService } = require('../../mobile/notification/notification.service');
        await NotificationService.sendIfNotAlreadySent(
          [studentId],
          'RESULT_PUBLISHED',
          exam.id,
          'Exam Result Published',
          `Your result for ${exam.examTitle} is available!`,
          { type: 'RESULT_PUBLISHED', examId: exam.id, route: `/(tabs)/exams/${exam.id}/result` }
        );

        const student = await prisma.student.findUnique({ where: { id: studentId } });
        const previousTier = student?.performanceStatus;

        let currentTier = previousTier;
        if (Number(finalMarks) < 40) currentTier = 'AT_RISK';
        else if (Number(finalMarks) >= 75) currentTier = 'EXCELLENT';
        else currentTier = 'AVERAGE';

        if (currentTier === 'AT_RISK' && previousTier !== 'AT_RISK') {
          await prisma.student.update({
            where: { id: studentId },
            data: { performanceStatus: 'AT_RISK', trendStatus: 'DECLINING' }
          });
          
          await NotificationService.sendIfNotAlreadySent(
            [studentId],
            'AI_ALERT',
            `AI-${exam.id}`,
            'Academic Performance Alert',
            'Your performance has been flagged as At-Risk. View your AI recommendations.',
            { type: 'AI_ALERT', route: '/(tabs)/academic' }
          );
        } else if (currentTier !== previousTier && currentTier) {
           await prisma.student.update({
            where: { id: studentId },
            data: { performanceStatus: currentTier as any }
          });
        }
      }
    } catch (e) {
      console.error('Failed to dispatch post-exam notifications:', e);
    }

    return submissionRecord;
  }

  async getStudentUpcomingExams(studentId: string) {
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId, enrollmentStatus: 'ACTIVE' },
      select: { subjectId: true },
    });

    const subjectIds = enrollments.map(e => e.subjectId);

    return await prisma.exam.findMany({
      where: {
        subjectId: { in: subjectIds },
        isPublished: true,
      },
      include: {
        subject: { select: { subjectName: true } },
        submissions: {
          where: { studentId },
        },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async notifyEligibleStudents(examId: string) {
    try {
      const exam = await prisma.exam.findUnique({
        where: { id: examId },
        include: { subject: true, teacher: { include: { user: true } } }
      });

      if (!exam || !exam.isPublished) return;

      const enrollments = await prisma.enrollment.findMany({
        where: {
          subjectId: exam.subjectId,
          enrollmentStatus: 'ACTIVE',
          ...(exam.batchId && { student: { batchId: exam.batchId } }),
        },
        include: { student: true },
      });

      if (enrollments.length === 0) return;

      const receiverIds = enrollments.map(e => e.student.userId);
      const teacherName = exam.teacher.user.fullName;

      await notificationService.createNotifications({
        senderId: exam.teacher.userId,
        receiverIds,
        title: 'New Exam Published',
        message: `${exam.examTitle} published by ${teacherName}.`,
        type: 'EXAM',
        referenceType: 'EXAM',
        referenceId: exam.id,
      });

      // Send push notification via Expo Push Notifications
      const studentIds = enrollments.map(e => e.student.id);
      NotificationService.sendIfNotAlreadySent(
        studentIds,
        'EXAM_PUBLISHED',
        exam.id,
        'New Exam Published',
        `${exam.examTitle} published by ${teacherName}.`,
        {
          type: 'EXAM_PUBLISHED',
          examId: exam.id,
          route: '/(tabs)/exams'
        }
      ).catch(err => console.error('FCM sending error:', err));

    } catch (err) {
      console.error('Failed to notify students of new exam:', err);
    }
  }
}

export const examsService = new ExamsService();
