import prisma from '../../../config/prisma.config';
import { AppError } from '../../../utils/AppError';
import { AttendanceStatus, AttendanceMethod, EnrollmentStatus } from '@prisma/client';

export class AttendanceService {
  static async markAttendanceByQR(
    token: string,
    subjectId: string,
    sessionDate: string,
    markedById: string
  ) {
    const qr = await prisma.qRCode.findUnique({
      where: { qrToken: token },
      include: {
        student: {
          select: {
            id: true,
            user: { select: { fullName: true, isActive: true } },
            indexNumber: true,
            fees: {
              where: { monthYear: { lte: new Date() } },
              orderBy: { monthYear: 'desc' },
              take: 1,
              select: {
                status: true,
                total: true,
                paid: true,
                dueDate: true,
                payments: {
                  where: { paymentStatus: 'VERIFIED' },
                  select: { amount: true }
                }
              },
            },
          },
        },
      },
    });

    if (!qr) {
      throw new AppError('Invalid QR code. Card may be outdated.', 400);
    }

    if (!qr.isActive) {
      throw new AppError('This QR code has been deactivated.', 400);
    }

    const student = qr.student;

    if (student.user && !student.user.isActive) {
      throw new AppError('Student account is inactive or disabled.', 403);
    }

    // 2. Fee checking (Calculated from payments)
    let feeStatus = 'UNPAID';
    if (student.fees && student.fees.length > 0) {
      const fee = student.fees[0];
      const total = Number(fee.total) || 0;
      
      const actualPaid = fee.payments 
        ? fee.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0) 
        : Number(fee.paid) || 0;

      if (actualPaid >= total && total > 0) {
        feeStatus = 'PAID';
      } else if (actualPaid > 0 && actualPaid < total) {
        feeStatus = 'PARTIALLY_PAID';
      } else {
        if (fee.dueDate && new Date() > new Date(fee.dueDate)) {
          feeStatus = 'OVERDUE';
        } else if (fee.status === 'OVERDUE') {
          feeStatus = 'OVERDUE';
        } else {
          feeStatus = 'UNPAID';
        }
      }
    }

    // 3. Check enrollment
    const enrolled = await prisma.enrollment.findFirst({
      where: {
        studentId: student.id,
        subjectId,
        enrollmentStatus: EnrollmentStatus.ACTIVE,
      },
    });

    if (!enrolled) {
      throw new AppError('Student is not actively enrolled in this subject.', 404);
    }

    // 4. Duplicate check & Date formatting
    const day = new Date(sessionDate);
    day.setHours(0, 0, 0, 0);

    const dup = await prisma.attendance.findUnique({
      where: {
        studentId_subjectId_attendanceDate: {
          studentId: student.id,
          subjectId,
          attendanceDate: day,
        },
      },
    });

    if (dup) {
      throw new AppError('Attendance already marked for today.', 409);
    }

    // 5. Save Attendance
    const rec = await prisma.attendance.create({
      data: {
        studentId: student.id,
        subjectId,
        teacherId: enrolled.teacherId, // Added from active enrollment
        qrCodeId: qr.id,
        attendanceDate: day,
        attendanceStatus: AttendanceStatus.PRESENT,
        attendanceMethod: AttendanceMethod.QR_CODE,
        isPresent: true,
        scannedTime: new Date(),
        markedAt: new Date(),
      },
    });

    return {
      success: true,
      studentName: student.user?.fullName || 'Unknown Student',
      studentCode: student.indexNumber || 'N/A',
      attendanceId: rec.id,
      feeStatus: feeStatus,
    };
  }

  static async getStudentsForAttendance(
    subjectId: string,
    batchId: string | undefined,
    teacherId: string | undefined,
    sessionDate: string,
    sessionTime: string
  ) {
    // 1. Fetch active enrollments for this subject
    const whereClause: any = {
      subjectId,
      enrollmentStatus: EnrollmentStatus.ACTIVE,
    };

    if (batchId) {
      whereClause.student = { batchId };
    }

    if (teacherId) {
      whereClause.teacherId = teacherId;
    }

    const enrollments = await prisma.enrollment.findMany({
      where: whereClause,
      include: {
        student: {
          select: {
            id: true,
            indexNumber: true,
            user: { select: { fullName: true, isActive: true } },
            fees: {
              where: { monthYear: { lte: new Date() } },
              orderBy: { monthYear: 'desc' },
              take: 1,
              select: {
                status: true,
                total: true,
                paid: true,
                dueDate: true,
                payments: {
                  where: { paymentStatus: 'VERIFIED' },
                  select: { amount: true },
                },
              },
            },
          },
        },
      },
    });

    // 2. Format response and calculate fee status
    const students = enrollments
      .filter((e) => e.student.user?.isActive) // only active users
      .map((e) => {
        const student = e.student;
        let feeStatus = 'UNPAID';

        if (student.fees && student.fees.length > 0) {
          const fee = student.fees[0];
          const total = Number(fee.total) || 0;
          const actualPaid = fee.payments
            ? fee.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0)
            : Number(fee.paid) || 0;

          if (actualPaid >= total && total > 0) {
            feeStatus = 'PAID';
          } else if (actualPaid > 0 && actualPaid < total) {
            feeStatus = 'PARTIALLY_PAID';
          } else {
            if (fee.dueDate && new Date() > new Date(fee.dueDate)) {
              feeStatus = 'OVERDUE';
            } else if (fee.status === 'OVERDUE') {
              feeStatus = 'OVERDUE';
            } else {
              feeStatus = 'UNPAID';
            }
          }
        }

        return {
          id: student.id,
          indexNumber: student.indexNumber,
          fullName: student.user?.fullName,
          feeStatus,
        };
      });

    return students;
  }

  static async markManualAttendance(
    records: {
      studentId: string;
      subjectId: string;
      teacherId?: string;
      batchId?: string | null;
      sessionDate: string;
      sessionTime: string;
      attendanceStatus: AttendanceStatus;
    }[],
    markedById: string
  ) {
    const results = [];
    
    for (const record of records) {
      const day = new Date(record.sessionDate);
      day.setHours(0, 0, 0, 0);

      const dup = await prisma.attendance.findUnique({
        where: {
          studentId_subjectId_attendanceDate: {
            studentId: record.studentId,
            subjectId: record.subjectId,
            attendanceDate: day,
          },
        },
      });

      if (dup) {
        throw new AppError(`Attendance already exists for student ID: ${record.studentId} on ${record.sessionDate}`, 409);
      }

      const enrolled = await prisma.enrollment.findFirst({
        where: {
          studentId: record.studentId,
          subjectId: record.subjectId,
          enrollmentStatus: EnrollmentStatus.ACTIVE,
        },
      });

      if (!enrolled) {
        throw new AppError(`Student ID: ${record.studentId} is not enrolled in subject ${record.subjectId}`, 404);
      }

      // Prepare date/time logic correctly (just combining them conceptually, but saving day and current time for scannedTime)
      const attendance = await prisma.attendance.create({
        data: {
          studentId: record.studentId,
          subjectId: record.subjectId,
          teacherId: record.teacherId || enrolled.teacherId, // Associate teacher
          attendanceDate: day,
          attendanceStatus: record.attendanceStatus,
          attendanceMethod: AttendanceMethod.MANUAL,
          isPresent: record.attendanceStatus === AttendanceStatus.PRESENT,
          scannedTime: new Date(), 
          markedAt: new Date(),
          // Note: we don't have sessionTime or batchId in the Attendance schema directly.
          // They can be tracked externally or we leave them out as requested.
        },
      });

      results.push(attendance);
    }

    return results;
  }
}
