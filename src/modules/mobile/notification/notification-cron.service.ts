import cron from 'node-cron';
import prisma from '../../../config/prisma.config';
import { NotificationService } from './notification.service';

class NotificationCronService {
  constructor() {
    this.init();
  }

  init() {
    console.log('NotificationCronService Initialized');

    // FR-02: Exam Reminder - 8:00 AM every day
    cron.schedule('0 8 * * *', async () => {
      console.log('Running FR-02: Exam reminder cron job');
      try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const dayAfterTomorrow = new Date(tomorrow);
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

        const upcomingExams = await prisma.exam.findMany({
          where: {
            startTime: {
              gte: tomorrow,
              lt: dayAfterTomorrow,
            },
            isPublished: true,
          },
          include: {
            subject: true,
          },
        });

        for (const exam of upcomingExams) {
          const enrollments = await prisma.enrollment.findMany({
            where: {
              subjectId: exam.subjectId,
              enrollmentStatus: 'ACTIVE',
              ...(exam.batchId && { student: { batchId: exam.batchId } }),
            },
            include: { student: true },
          });

          if (enrollments.length > 0) {
            const studentIds = enrollments.map(e => e.student.id);
            await NotificationService.sendIfNotAlreadySent(
              studentIds,
              'EXAM_REMINDER',
              exam.id,
              'Upcoming Exam Reminder',
              `Your exam for ${exam.subject.subjectName} is tomorrow!`,
              { type: 'EXAM_REMINDER', examId: exam.id, route: '/(tabs)/exams' }
            );
          }
        }
      } catch (err) {
        console.error('Error in exam reminder cron:', err);
      }
    });

    // FR-05: Fee reminder - 9:00 AM every day
    cron.schedule('0 9 * * *', async () => {
      console.log('Running FR-05: Fee reminder cron job');
      try {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 7);
        targetDate.setHours(0, 0, 0, 0);

        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);

        const upcomingFees = await prisma.fee.findMany({
          where: {
            status: 'UNPAID',
            dueDate: {
              gte: targetDate,
              lt: nextDay,
            },
          },
          include: { student: true },
        });

        for (const fee of upcomingFees) {
          await NotificationService.sendIfNotAlreadySent(
            [fee.studentId],
            'FEE_REMINDER',
            fee.id,
            'Fee Payment Reminder',
            `Your fee of ${fee.total} is due in 7 days.`,
            { type: 'FEE_REMINDER', feeId: fee.id, route: '/(tabs)/more/payments' }
          );
        }
      } catch (err) {
        console.error('Error in fee reminder cron:', err);
      }
    });

    // FR-06: Fee overdue - 10:00 AM every day
    cron.schedule('0 10 * * *', async () => {
      console.log('Running FR-06: Fee overdue cron job');
      try {
        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

        const overdueFees = await prisma.fee.findMany({
          where: {
            status: 'OVERDUE',
            dueDate: {
              lte: twoMonthsAgo,
            },
          },
        });

        for (const fee of overdueFees) {
          await NotificationService.sendIfNotAlreadySent(
            [fee.studentId],
            'FEE_OVERDUE',
            fee.id,
            'Fee Overdue Warning',
            `Your fee has been unpaid for over 2 months. Please pay immediately to avoid restriction.`,
            { type: 'FEE_OVERDUE', feeId: fee.id, route: '/(tabs)/more/payments' }
          );
        }
      } catch (err) {
        console.error('Error in fee overdue cron:', err);
      }
    });

    // FR-10: Monthly progress report - 1st of every month at 7:00 AM
    cron.schedule('0 7 1 * *', async () => {
      console.log('Running FR-10: Monthly progress report cron job');
      try {
        const students = await prisma.student.findMany({
          where: { approvalStatus: 'APPROVED' },
        });

        for (const student of students) {
          const monthYear = `${new Date().getFullYear()}-${new Date().getMonth() + 1}`;
          await NotificationService.sendIfNotAlreadySent(
            [student.id],
            'PROGRESS_REPORT',
            monthYear,
            'Monthly Progress Report Ready',
            'Your monthly progress report is now available for review.',
            { type: 'PROGRESS_REPORT', route: '/(tabs)/academic' }
          );
        }
      } catch (err) {
        console.error('Error in progress report cron:', err);
      }
    });

    // FR-12: AI Alert Safety Net - 6:00 AM every day
    cron.schedule('0 6 * * *', async () => {
      console.log('Running FR-12: AI Alert Safety Net cron job');
      try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const atRiskPredictions = await prisma.performancePrediction.findMany({
          where: {
            performanceLevel: 'AT_RISK',
            createdAt: { gte: yesterday },
          },
        });

        for (const prediction of atRiskPredictions) {
          await NotificationService.sendIfNotAlreadySent(
            [prediction.studentId],
            'AI_ALERT',
            prediction.id,
            'Academic Performance Alert',
            'Your performance has been flagged as At-Risk. View your AI recommendations.',
            { type: 'AI_ALERT', predictionId: prediction.id, route: '/(tabs)/academic' }
          );
        }
      } catch (err) {
        console.error('Error in AI Alert cron:', err);
      }
    });
  }
}

export const notificationCronService = new NotificationCronService();
