import prisma from '../../../config/prisma.config';
import { Prisma } from '@prisma/client';
import { AppError } from '../../../utils/AppError';

export class TeacherStudentsService {
  /**
   * Get students assigned to the logged-in teacher
   */
  static async getTeacherStudents(
    userId: string,
    params: { page: number; limit: number; search?: string }
  ) {
    const { page, limit, search } = params;

    // Find the teacher record by userId
    const teacher = await prisma.teacher.findFirst({
      where: { userId, deletedAt: null },
      include: {
        subjectAllocations: {
          where: { status: 'ACTIVE' },
          include: {
            batches: true,
          },
        },
      },
    });

    if (!teacher) {
      throw new AppError('Teacher profile not found.', 404);
    }

    // Determine the teacher's student filtering conditions
    const orConditions: Prisma.StudentWhereInput[] = [];

    // 1. Direct assignment via active enrollment.teacherId
    orConditions.push({
      enrollments: {
        some: {
          teacherId: teacher.id,
          enrollmentStatus: 'ACTIVE',
        },
      },
    });

    // 2. Allocation relationship (teacher -> subject -> batch -> enrollment/student)
    for (const alloc of teacher.subjectAllocations) {
      const batchIds = alloc.batches.map((b) => b.id);
      if (batchIds.length > 0) {
        orConditions.push({
          batchId: { in: batchIds },
          enrollments: {
            some: {
              subjectId: alloc.subjectId,
              enrollmentStatus: 'ACTIVE',
            },
          },
        });
      }
    }

    const where: Prisma.StudentWhereInput = {
      deletedAt: null,
      approvalStatus: 'APPROVED',
      OR: orConditions,
    };

    if (search) {
      where.AND = [
        {
          OR: [
            { user: { fullName: { contains: search, mode: 'insensitive' } } },
            { user: { email: { contains: search, mode: 'insensitive' } } },
            { indexNumber: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              fullName: true,
              email: true,
              profileImage: true,
              isActive: true,
            },
          },
          batchRecord: {
            select: {
              batchName: true,
            },
          },
          enrollments: {
            where: { enrollmentStatus: 'ACTIVE' },
            include: {
              subject: {
                select: {
                  id: true,
                  subjectName: true,
                },
              },
            },
          },
        },
        orderBy: { user: { fullName: 'asc' } },
      }),
      prisma.student.count({ where }),
    ]);

    return {
      data: students.map((s) => ({
        id: s.id,
        fullName: s.user.fullName,
        email: s.user.email,
        profileImage: s.user.profileImage,
        indexNumber: s.indexNumber,
        phone: s.phone,
        batch: s.batchRecord?.batchName || s.batch || 'N/A',
        attendancePercentage: Number(s.attendancePercentage),
        isActive: s.user.isActive,
        subjects: s.enrollments.map((e) => e.subject.subjectName),
      })),
      total,
    };
  }

  /**
   * Get detailed profile info for a specific student assigned to this teacher
   */
  static async getTeacherStudentById(userId: string, studentId: string) {
    // Find the teacher record by userId
    const teacher = await prisma.teacher.findFirst({
      where: { userId, deletedAt: null },
      include: {
        subjectAllocations: {
          where: { status: 'ACTIVE' },
          include: {
            batches: true,
          },
        },
      },
    });

    if (!teacher) {
      throw new AppError('Teacher profile not found.', 404);
    }

    // Determine the teacher's student filtering conditions
    const orConditions: Prisma.StudentWhereInput[] = [];

    // 1. Direct assignment via active enrollment.teacherId
    orConditions.push({
      enrollments: {
        some: {
          teacherId: teacher.id,
          enrollmentStatus: 'ACTIVE',
        },
      },
    });

    // 2. Allocation relationship (teacher -> subject -> batch -> enrollment/student)
    for (const alloc of teacher.subjectAllocations) {
      const batchIds = alloc.batches.map((b) => b.id);
      if (batchIds.length > 0) {
        orConditions.push({
          batchId: { in: batchIds },
          enrollments: {
            some: {
              subjectId: alloc.subjectId,
              enrollmentStatus: 'ACTIVE',
            },
          },
        });
      }
    }

    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        deletedAt: null,
        approvalStatus: 'APPROVED',
        OR: orConditions,
      },
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
            profileImage: true,
            isActive: true,
            phone: true,
          },
        },
        parent: true,
        stream: true,
        batchRecord: true,
        enrollments: {
          where: { enrollmentStatus: 'ACTIVE' },
          include: {
            subject: true,
            teacher: {
              include: {
                user: { select: { fullName: true } },
              },
            },
          },
        },
      },
    });

    if (!student) {
      throw new AppError('Student not found or not assigned to you.', 404);
    }

    // Retrieve attendance counts
    const attendances = await prisma.attendance.groupBy({
      by: ['attendanceStatus'],
      where: { studentId },
      _count: {
        attendanceStatus: true,
      },
    });

    const attendanceSummary = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      total: 0,
    };

    attendances.forEach((item) => {
      const status = item.attendanceStatus.toLowerCase();
      const count = item._count.attendanceStatus;
      if (status === 'present') attendanceSummary.present = count;
      else if (status === 'absent') attendanceSummary.absent = count;
      else if (status === 'late') attendanceSummary.late = count;
      else if (status === 'excused') attendanceSummary.excused = count;
    });
    attendanceSummary.total =
      attendanceSummary.present +
      attendanceSummary.absent +
      attendanceSummary.late +
      attendanceSummary.excused;

    // Retrieve academic results (limit to latest 10)
    const results = await prisma.result.findMany({
      where: { studentId },
      include: {
        exam: { select: { examTitle: true } },
        quiz: { select: { quizTitle: true } },
        teacher: { include: { user: { select: { fullName: true } } } },
      },
      orderBy: { recordedAt: 'desc' },
      take: 10,
    });

    return {
      student: {
        id: student.id,
        fullName: student.user.fullName,
        email: student.user.email,
        phone: student.phone || student.user.phone || 'N/A',
        profileImage: student.user.profileImage,
        indexNumber: student.indexNumber,
        gender: student.gender,
        address: student.address,
        school: student.school,
        dateOfBirth: student.dateOfBirth,
        batch: student.batchRecord?.batchName || student.batch || 'N/A',
        stream: student.stream?.streamName || 'N/A',
        enrollmentStatus: student.approvalStatus,
        isActive: student.user.isActive,
        enrollments: student.enrollments.map((enr) => ({
          subjectName: enr.subject.subjectName,
          subjectCode: enr.subject.subjectCode,
          teacherName: enr.teacher?.user.fullName || 'Unassigned',
          feeAmount: Number(enr.subject.feeAmount),
          status: enr.enrollmentStatus,
        })),
        parent: student.parent
          ? {
              name: student.parent.parentName,
              relation: student.parent.relation,
              phone: student.parent.phone,
              email: student.parent.email,
            }
          : null,
      },
      attendanceSummary,
      academicPerformance: results.map((r) => ({
        id: r.id,
        title: r.exam?.examTitle || r.quiz?.quizTitle || 'Assignment/Activity',
        type: r.exam ? 'Exam' : r.quiz ? 'Quiz' : 'Other',
        marks: Number(r.marks),
        grade: r.grade,
        feedback: r.feedback,
        recordedAt: r.recordedAt,
        teacherName: r.teacher?.user.fullName || 'System',
      })),
    };
  }
}
