import prisma from '../../../config/prisma.config';
import { AppError } from '../../../utils/AppError';
import { ApprovalStatus, RegistrationPaymentStatus, Role } from '@prisma/client';

export class ManagerService {
  /**
   * Get all newly registered students
   */
  static async getRegisteredStudents() {
    const students = await prisma.student.findMany({
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
      email: student.user.email,
      stream: student.stream?.streamName || 'N/A',
      totalFeeAmount: Number(student.totalFeeAmount),
      paymentStatus: student.paymentStatus,
      approvalStatus: student.approvalStatus,
      registeredDate: student.createdAt,
    }));
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
      },
    });

    if (!student) {
      throw new AppError('Student not found.', 404);
    }

    return student;
  }

  /**
   * Update payment status of a registered student
   */
  static async updatePaymentStatus(id: string, paymentStatus: RegistrationPaymentStatus) {
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) throw new AppError('Student not found.', 404);

    return prisma.student.update({
      where: { id },
      data: { paymentStatus },
    });
  }

  /**
   * Update approval status of a registered student
   */
  static async updateApprovalStatus(id: string, approvalStatus: ApprovalStatus) {
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) throw new AppError('Student not found.', 404);

    return prisma.student.update({
      where: { id },
      data: { approvalStatus },
    });
  }
}

export default ManagerService;
