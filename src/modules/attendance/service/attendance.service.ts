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
    // 1. Find QR record by token
    const qr = await prisma.qRCode.findUnique({
      where: { qrToken: token },
      include: {
        student: {
          select: {
            id: true,
            user: { select: { fullName: true } },
            indexNumber: true,
            fees: {
              where: { status: 'OVERDUE' },
              select: { id: true },
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

    // 2. Fee Restriction Check (e.g., 3 or more overdue months)
    if (student.fees.length >= 3) {
      throw new AppError('Student account restricted due to unpaid fees.', 403);
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
    };
  }
}
