import prisma from '../../../config/prisma.config';
import { AppError } from '../../../utils/AppError';
import { ApprovalStatus, RegistrationPaymentStatus, Role } from '@prisma/client';
import { notificationService } from '../../notification/service/notification.service';

export class ManagerService {
  /**
   * Get all newly registered students
   */
  static async getRegisteredStudents() {
    const students = await prisma.student.findMany({
      where: { approvalStatus: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
            isActive: true,
          },
        },
        stream: {
          select: {
            streamName: true,
          },
        },
      },
    });

    return students.map((student) => ({
      id: student.id,
      studentName: student.user.fullName,
      indexNumber: student.indexNumber,
      email: student.user.email,
      stream: student.stream?.streamName || 'N/A',
      qrCode: student.qrCode,
      totalFeeAmount: Number(student.totalFeeAmount),
      paymentStatus: student.paymentStatus,
      approvalStatus: student.approvalStatus,
      registeredDate: student.createdAt,
    }));
  }

  /**
   * Get all approved students for Student Management
   */
  static async getApprovedStudents(filters?: {
    search?: string;
    indexNumber?: string;
    batchId?: string;
    subjectId?: string;
    status?: string;
  }) {
    const where: any = { approvalStatus: 'APPROVED' };

    if (filters) {
      const userConditions: any = {};
      
      if (filters.search) {
        userConditions.OR = [
          { fullName: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      if (filters.status) {
        userConditions.isActive = filters.status === 'ACTIVE';
      }

      if (Object.keys(userConditions).length > 0) {
        where.user = userConditions;
      }

      if (filters.indexNumber) {
        where.indexNumber = { contains: filters.indexNumber, mode: 'insensitive' };
      }

      if (filters.batchId) {
        where.batchId = filters.batchId;
      }

      if (filters.subjectId) {
        where.enrollments = {
          some: {
            subjectId: filters.subjectId,
            enrollmentStatus: 'ACTIVE',
          },
        };
      }
    }

    const students = await prisma.student.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
            isActive: true,
          },
        },
        stream: {
          select: {
            streamName: true,
          },
        },
        fees: {
          orderBy: { monthYear: 'desc' },
          take: 1,
        },
      },
    });

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    return students.map((student) => {
      let monthlyFeeStatus = 'UNPAID';
      
      if (student.fees.length > 0) {
        const latestFee = student.fees[0];
        const feeDate = new Date(latestFee.monthYear);
        if (feeDate.getMonth() === currentMonth && feeDate.getFullYear() === currentYear) {
          monthlyFeeStatus = latestFee.status;
        }
      }

      return {
        id: student.id,
        studentName: student.user.fullName,
        indexNumber: student.indexNumber,
        email: student.user.email,
        stream: student.stream?.streamName || 'N/A',
        qrCode: student.qrCode,
        isActive: student.user.isActive,
        monthlyFeeStatus,
      };
    });
  }

  /**
   * Get full details of a specific registered student
   */
  static async getRegisteredStudentById(id: string) {
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
            isActive: true,
          },
        },
        parent: true,
        stream: true,
        enrollments: {
          where: { enrollmentStatus: 'ACTIVE' },
          include: {
            subject: true,
            teacher: {
              include: {
                user: {
                  select: {
                    fullName: true,
                  },
                },
              },
            },
          },
        },
        fees: {
          orderBy: { monthYear: 'desc' },
          include: { payments: true }
        },
        enrollmentHistories: {
          orderBy: { changedAt: 'desc' },
          include: {
            changedBy: { select: { fullName: true } }
          }
        },
      },
    });

    if (!student) {
      throw new AppError('Student not found.', 404);
    }

    console.log(`[getRegisteredStudentById] Returning ${student.enrollments.length} ACTIVE enrollments for student ${id}`);

    return student;
  }

  /**
   * Update monthly fee status of a student
   */
  static async updateMonthlyFeeStatus(id: string, status: 'PAID' | 'UNPAID') {
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) throw new AppError('Student not found.', 404);

    const now = new Date();
    const monthYear = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));

    await prisma.fee.upsert({
      where: {
        studentId_monthYear: {
          studentId: id,
          monthYear: monthYear,
        },
      },
      update: {
        status: status,
        paid: status === 'PAID' ? student.totalFeeAmount : 0,
      },
      create: {
        studentId: id,
        monthYear: monthYear,
        status: status,
        total: student.totalFeeAmount,
        paid: status === 'PAID' ? student.totalFeeAmount : 0,
      },
    });
  }

  /**
   * Update payment status of a registered student
   */
  static async updatePaymentStatus(id: string, paymentStatus: RegistrationPaymentStatus) {
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) throw new AppError('Student not found.', 404);

    let resultStudent;
    if (paymentStatus === 'PAID' && student.paymentStatus !== 'PAID') {
      resultStudent = await prisma.$transaction(async (tx) => {
        const updatedStudent = await tx.student.update({
          where: { id },
          data: { paymentStatus },
        });

        // Determine the current month
        const now = new Date();
        const monthYear = new Date(now.getFullYear(), now.getMonth(), 1);

        // Create the Fee record for the first month
        const fee = await tx.fee.upsert({
          where: {
            studentId_monthYear: {
              studentId: id,
              monthYear: monthYear,
            },
          },
          update: {
            paid: student.totalFeeAmount,
            status: 'PAID',
          },
          create: {
            studentId: id,
            total: student.totalFeeAmount,
            paid: student.totalFeeAmount,
            status: 'PAID',
            monthYear: monthYear,
            dueDate: new Date(now.getFullYear(), now.getMonth(), 10), // Example due date
          },
        });

        // Record the payment transaction
        await tx.payment.create({
          data: {
            studentId: id,
            feeId: fee.id,
            amount: student.totalFeeAmount,
            paymentMethod: 'CASH', // Defaulting to CASH for manual manager approval, or can be extended
            paymentStatus: 'VERIFIED',
            paymentDate: new Date(),
          },
        });

        return updatedStudent;
      });
    } else {
      resultStudent = await prisma.student.update({
        where: { id },
        data: { paymentStatus },
      });
    }

    // Notify student about payment status change
    try {
      const studentDetails = await prisma.student.findUnique({
        where: { id },
        include: { user: true }
      });
      if (studentDetails) {
        let title = 'Payment Status Updated';
        let message = `Your registration payment status has been updated to ${paymentStatus}.`;
        if (paymentStatus === 'PAID') {
          title = 'Payment Approved';
          message = `Your registration fee payment of LKR ${studentDetails.totalFeeAmount} has been approved.`;
        }

        await notificationService.createNotification({
          senderId: null,
          receiverId: studentDetails.userId,
          title,
          message,
          type: 'PAYMENT',
          referenceType: 'PAYMENT',
          referenceId: id,
        });
      }
    } catch (err) {
      console.error('Failed to send payment notification to student:', err);
    }

    return resultStudent;
  }

  /**
   * Update approval status of a registered student
   */
  static async updateApprovalStatus(id: string, approvalStatus: ApprovalStatus) {
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) throw new AppError('Student not found.', 404);

    if (approvalStatus === 'APPROVED') {
      return prisma.$transaction(async (tx) => {
        const updatedStudent = await tx.student.update({
          where: { id },
          data: { approvalStatus, enrolledAt: new Date() },
        });
        await tx.user.update({
          where: { id: student.userId },
          data: { status: 'ACTIVE', isActive: true },
        });
        return updatedStudent;
      });
    }

    const updatedStudent = await prisma.student.update({
      where: { id },
      data: { approvalStatus },
    });

    if (approvalStatus === 'REJECTED') {
      try {
        const { NotificationService } = require('../../mobile/notification/notification.service');
        await NotificationService.sendIfNotAlreadySent(
          [id],
          'ACCOUNT_ALERT',
          `${approvalStatus}-${new Date().toISOString().split('T')[0]}`,
          `Account ${approvalStatus}`,
          `Your account has been marked as ${approvalStatus.toLowerCase()}.`,
          { type: 'ACCOUNT_ALERT' }
        );
      } catch (err) {
        console.error('Failed to notify student of account restriction:', err);
      }
    }

    return updatedStudent;
  }
  /**
   * Toggle student's active status
   */
  static async toggleStudentStatus(id: string) {
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) throw new AppError('Student not found.', 404);

    const user = await prisma.user.findUnique({ where: { id: student.userId } });
    if (!user) throw new AppError('User not found.', 404);

    return prisma.user.update({
      where: { id: user.id },
      data: { isActive: !user.isActive, status: !user.isActive ? 'ACTIVE' : 'INACTIVE' },
    });
  }

  /**
   * Update student details
   */
  static async updateStudent(id: string, data: any) {
    const student = await prisma.student.findUnique({
      where: { id },
      include: { enrollments: true, parent: true },
    });
    if (!student) throw new AppError('Student not found.', 404);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update User
      if (data.fullName || data.phone || data.email) {
        await tx.user.update({
          where: { id: student.userId },
          data: {
            ...(data.fullName && { fullName: data.fullName }),
            ...(data.phone && { phone: data.phone }),
            ...(data.email && { email: data.email }),
          },
        });
      }

      // 2. Update Parent
      if (data.parentName || data.parentPhone || data.parentOccupation || data.parentRelation || data.parentEmail) {
        if (student.parentId) {
          await tx.parent.update({
            where: { id: student.parentId },
            data: {
              ...(data.parentName && { parentName: data.parentName }),
              ...(data.parentPhone && { phone: data.parentPhone }),
              ...(data.parentOccupation && { occupation: data.parentOccupation }),
              ...(data.parentRelation && { relation: data.parentRelation }),
              ...(data.parentEmail && { email: data.parentEmail }),
            },
          });
        } else {
          const newParent = await tx.parent.create({
            data: {
              parentName: data.parentName || 'Parent',
              phone: data.parentPhone || null,
              occupation: data.parentOccupation || null,
              relation: data.parentRelation || null,
              email: data.parentEmail || null,
            },
          });
          await tx.student.update({
            where: { id },
            data: { parentId: newParent.id },
          });
        }
      }

      // 3. Update Student (Common details)
      await tx.student.update({
        where: { id },
        data: {
          ...(data.school !== undefined && { school: data.school }),
          ...(data.address && { address: data.address }),
          ...(data.dateOfBirth && { dateOfBirth: new Date(data.dateOfBirth) }),
          ...(data.gender && { gender: data.gender }),
          ...(data.streamId && { streamId: data.streamId }),
          ...(data.nic !== undefined && { nic: data.nic }),
        },
      });

      // 4. Update Enrollments (Subjects & Teachers)
      if (data.subjects && Array.isArray(data.subjects)) {
        if (data.subjects.length < 1 || data.subjects.length > 3) {
          throw new AppError('A student must select between 1 and 3 subjects.', 400);
        }

        // Delete existing enrollments
        await tx.enrollment.deleteMany({
          where: { studentId: id },
        });

        // Calculate new total fee amount
        let totalFee = 0;

        for (const sub of data.subjects) {
          const subject = await tx.subject.findUnique({ where: { id: sub.subjectId } });
          if (!subject) throw new AppError(`Subject not found: ${sub.subjectId}`, 404);

          totalFee += Number(subject.feeAmount);

          await tx.enrollment.create({
            data: {
              studentId: id,
              subjectId: sub.subjectId,
              teacherId: sub.teacherId,
              enrollmentStatus: 'ACTIVE',
            },
          });
        }

        // Update total fee
        await tx.student.update({
          where: { id },
          data: {
            totalFeeAmount: totalFee,
            lastFeeUpdateDate: new Date(),
          },
        });
      }

      return { success: true };
    });

    // Notify Teachers about student assignment
    try {
      const enrollments = await prisma.enrollment.findMany({
        where: { studentId: id, enrollmentStatus: 'ACTIVE' },
        include: { teacher: true, student: { include: { user: true } } }
      });

      for (const enrollment of enrollments) {
        const teacher = enrollment.teacher;
        if (teacher) {
          const teacherUserId = teacher.userId;
          const studentName = enrollment.student.user.fullName;
          const batchName = enrollment.student.batch || 'Class';

          await notificationService.createNotification({
            senderId: enrollment.student.userId,
            receiverId: teacherUserId,
            title: 'New Student Assigned',
            message: `${studentName} joined Batch ${batchName}.`,
            type: 'STUDENT_ENROLLMENT',
            referenceType: 'ENROLLMENT',
            referenceId: enrollment.id,
          });
        }
      }
    } catch (err) {
      console.error('Failed to trigger notifications for student enrollments update:', err);
    }

    return result;
  }
  /**
   * Re-Enroll Student
   */
  static async reEnrollStudent(id: string, data: any, actorId: string) {
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        enrollments: {
          where: { enrollmentStatus: 'ACTIVE' },
          include: { subject: true, teacher: { include: { user: true } } },
        },
        stream: true,
      },
    });

    if (!student) throw new AppError('Student not found.', 404);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Snapshot previous data
      const previousStream = student.stream?.streamName || null;
      const previousMonthlyFee = student.totalFeeAmount;
      const previousSubjects = student.enrollments.map(e => ({
        subjectId: e.subjectId,
        subjectName: e.subject.subjectName,
        teacherId: e.teacherId,
        teacherName: e.teacher?.user.fullName || null,
        feeAmount: e.subject.feeAmount,
      }));

      // 2. Mark existing ACTIVE enrollments as COMPLETED and set endDate
      const effectiveDate = new Date(data.effectiveDate);
      await tx.enrollment.updateMany({
        where: { studentId: id, enrollmentStatus: 'ACTIVE' },
        data: {
          enrollmentStatus: 'COMPLETED',
          endDate: effectiveDate,
        },
      });

      // 3. Create new Enrollments and calculate new fee
      if (!data.subjects || !Array.isArray(data.subjects) || data.subjects.length < 1 || data.subjects.length > 3) {
        throw new AppError('A student must select between 1 and 3 subjects.', 400);
      }

      let newMonthlyFee = 0;
      const newSubjectsData = [];

      for (const sub of data.subjects) {
        const subject = await tx.subject.findUnique({ where: { id: sub.subjectId } });
        if (!subject) throw new AppError(`Subject not found: ${sub.subjectId}`, 404);

        let teacherName = null;
        if (sub.teacherId) {
          const teacher = await tx.teacher.findUnique({ where: { id: sub.teacherId }, include: { user: true } });
          if (teacher) teacherName = teacher.user.fullName;
        }

        newMonthlyFee += Number(subject.feeAmount);
        newSubjectsData.push({
          subjectId: subject.id,
          subjectName: subject.subjectName,
          teacherId: sub.teacherId || null,
          teacherName,
          feeAmount: subject.feeAmount,
        });

        await tx.enrollment.create({
          data: {
            studentId: id,
            subjectId: sub.subjectId,
            teacherId: sub.teacherId || null,
            enrollmentStatus: 'ACTIVE',
            enrolledDate: effectiveDate,
          },
        });
      }

      // 4. Update Student record
      await tx.student.update({
        where: { id },
        data: {
          streamId: data.streamId,
          totalFeeAmount: newMonthlyFee,
          lastFeeUpdateDate: effectiveDate,
        },
      });

      // 5. Create History Record
      await tx.enrollmentHistory.create({
        data: {
          studentId: id,
          previousStream,
          previousSubjects,
          previousMonthlyFee,
          newStream: data.newStreamName || null,
          newSubjects: newSubjectsData,
          newMonthlyFee,
          effectiveDate,
          changedById: actorId,
        },
      });

      return { success: true };
    });

    // Notify Teachers about student assignment
    try {
      const enrollments = await prisma.enrollment.findMany({
        where: { studentId: id, enrollmentStatus: 'ACTIVE' },
        include: { teacher: true, student: { include: { user: true } } }
      });

      for (const enrollment of enrollments) {
        const teacher = enrollment.teacher;
        if (teacher) {
          const teacherUserId = teacher.userId;
          const studentName = enrollment.student.user.fullName;
          const batchName = enrollment.student.batch || 'Class';

          await notificationService.createNotification({
            senderId: enrollment.student.userId,
            receiverId: teacherUserId,
            title: 'New Student Assigned',
            message: `${studentName} joined Batch ${batchName}.`,
            type: 'STUDENT_ENROLLMENT',
            referenceType: 'ENROLLMENT',
            referenceId: enrollment.id,
          });
        }
      }
    } catch (err) {
      console.error('Failed to trigger notifications for student re-enrollment:', err);
    }

    return result;
  }
}

export default ManagerService;
