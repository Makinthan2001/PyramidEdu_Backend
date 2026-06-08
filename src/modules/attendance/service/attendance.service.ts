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

    const day = new Date(sessionDate);
    day.setHours(0, 0, 0, 0);

    // Check for ACTIVE ClassSession first so we know which session we are marking attendance for
    const classSession = await prisma.classSession.findFirst({
      where: {
        subjectId,
        sessionDate: day,
        status: 'ACTIVE',
      },
    });

    if (!classSession) {
      throw new AppError('There is no active attendance session for this subject today.', 403);
    }

    // 4. Duplicate check based on class session
    const dup = await prisma.attendance.findUnique({
      where: {
        studentId_classSessionId: {
          studentId: student.id,
          classSessionId: classSession.id,
        },
      },
    });

    if (dup) {
      throw new AppError('Attendance already marked for this session.', 409);
    }

    // 5. Save Attendance
    const rec = await prisma.attendance.create({
      data: {
        studentId: student.id,
        subjectId,
        teacherId: enrolled.teacherId, // Added from active enrollment
        classSessionId: classSession.id,
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

    const day = new Date(sessionDate);
    day.setHours(0, 0, 0, 0);

    const classSession = await prisma.classSession.findFirst({
      where: {
        subjectId,
        teacherId,
        sessionDate: day,
        sessionTime,
      }
    });

    if (!classSession) {
      return [];
    }

    const enrollments = await prisma.enrollment.findMany({
      where: whereClause,
      include: {
        student: {
          select: {
            id: true,
            indexNumber: true,
            user: { select: { fullName: true, isActive: true } },
            attendances: {
              where: {
                classSessionId: classSession?.id,
              },
            },
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
          studentId: student.id,
          studentName: student.user?.fullName,
          indexNumber: student.indexNumber,
          feeStatus,
          isPresent: student.attendances && student.attendances.length > 0 && student.attendances[0].isPresent,
          hasRecord: student.attendances && student.attendances.length > 0,
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
      classSessionId: string;
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

      // Upsert so that manual saves overwrite existing records for the day instead of crashing
      const attendance = await prisma.attendance.upsert({
        where: {
          studentId_classSessionId: {
            studentId: record.studentId,
            classSessionId: record.classSessionId,
          },
        },
        update: {
          attendanceStatus: record.attendanceStatus,
          attendanceMethod: AttendanceMethod.MANUAL,
          isPresent: record.attendanceStatus === AttendanceStatus.PRESENT,
          markedAt: new Date(),
          teacherId: record.teacherId || enrolled.teacherId,
        },
        create: {
          studentId: record.studentId,
          subjectId: record.subjectId,
          classSessionId: record.classSessionId,
          teacherId: record.teacherId || enrolled.teacherId, // Associate teacher
          attendanceDate: day,
          attendanceStatus: record.attendanceStatus,
          attendanceMethod: AttendanceMethod.MANUAL,
          isPresent: record.attendanceStatus === AttendanceStatus.PRESENT,
          markedAt: new Date(),
        },
      });

      results.push(attendance);
    }

    return results;
  }

  static async createSession(data: { subjectId: string; teacherId: string; batchId?: string; sessionDate: string; sessionTime: string; createdById: string }) {
    const day = new Date(data.sessionDate);
    day.setHours(0, 0, 0, 0);

    const dup = await prisma.classSession.findFirst({
      where: {
        subjectId: data.subjectId,
        teacherId: data.teacherId,
        sessionDate: day,
        sessionTime: data.sessionTime,
        batchId: data.batchId || null,
      },
    });

    if (dup) {
      throw new AppError('A class session with these details already exists.', 409);
    }

    return prisma.classSession.create({
      data: {
        subjectId: data.subjectId,
        teacherId: data.teacherId,
        sessionDate: day,
        sessionTime: data.sessionTime,
        batchId: data.batchId || null,
        createdById: data.createdById,
        status: 'CREATED',
      },
    });
  }

  static async fetchSession(subjectId: string, teacherId: string, sessionDate: string, sessionTime: string, batchId?: string) {
    const day = new Date(sessionDate);
    day.setHours(0, 0, 0, 0);

    return prisma.classSession.findFirst({
      where: {
        subjectId,
        teacherId,
        sessionDate: day,
        sessionTime,
        batchId: batchId || null,
      },
      include: {
        attendances: true,
      },
    });
  }

  static async fetchSessionsByDate(sessionDate: string) {
    const day = new Date(sessionDate);
    day.setHours(0, 0, 0, 0);

    return prisma.classSession.findMany({
      where: {
        sessionDate: day,
      },
      include: {
        subject: true,
        teacher: { include: { user: true } },
        batch: true,
      },
      orderBy: {
        sessionTime: 'asc',
      },
    });
  }

  static async startSession(id: string) {
    const session = await prisma.classSession.findUnique({ where: { id } });
    if (!session) throw new AppError('Session not found', 404);
    if (session.status !== 'CREATED') throw new AppError('Only CREATED sessions can be started.', 400);

    return prisma.classSession.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        attendanceStartTime: new Date(),
      },
    });
  }

  static async endSession(id: string) {
    const session = await prisma.classSession.findUnique({
      where: { id },
      include: { attendances: true },
    });

    if (!session) throw new AppError('Session not found', 404);
    if (session.status !== 'ACTIVE') throw new AppError('Only ACTIVE sessions can be ended.', 400);

    const now = new Date();

    // 1. Mark as completed
    await prisma.classSession.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        attendanceEndTime: now,
      },
    });

    // 2. Fetch Eligible students
    const whereClause: any = {
      subjectId: session.subjectId,
      teacherId: session.teacherId,
      enrollmentStatus: EnrollmentStatus.ACTIVE,
    };

    if (session.batchId) {
      whereClause.student = { batchId: session.batchId };
    }

    const enrollments = await prisma.enrollment.findMany({
      where: whereClause,
      include: { student: true },
    });

    // 3. Compare and mark absentees
    const markedStudentIds = new Set(session.attendances.map(a => a.studentId));
    const absentRecords = [];

    for (const enrollment of enrollments) {
      if (!markedStudentIds.has(enrollment.studentId)) {
        absentRecords.push({
          studentId: enrollment.studentId,
          subjectId: session.subjectId,
          teacherId: enrollment.teacherId,
          classSessionId: id,
          attendanceDate: session.sessionDate,
          attendanceStatus: AttendanceStatus.ABSENT,
          attendanceMethod: AttendanceMethod.SYSTEM_GENERATED,
          isPresent: false,
          markedAt: now,
        });
      }
    }

    if (absentRecords.length > 0) {
      await prisma.attendance.createMany({
        data: absentRecords,
        skipDuplicates: true,
      });
    }

    return {
      sessionStatus: 'COMPLETED',
      absenteesMarked: absentRecords.length,
    };
  }
}

