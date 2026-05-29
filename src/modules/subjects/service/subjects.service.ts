import { Prisma, UserRole } from '@prisma/client';
import prisma from '../../../config/prisma.config';
import { AppError } from '../../../utils/AppError';
import type { CreateSubjectDto } from '../dto/create-subject.dto';
import type { UpdateSubjectDto } from '../dto/update-subject.dto';
import type { EnrollStudentDto } from '../dto/enroll-student.dto';

export interface SubjectsQueryParams {
  active?: boolean;
  teacherId?: number;
  search?: string;
  code?: string;
  userRole?: UserRole;
  userId?: number;
}

function decimalToNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === 'number' ? value : Number(value);
}

async function getTeacherProfileByUserId(userId: number) {
  return prisma.teacher.findUnique({
    where: { userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      user: {
        select: {
          isActive: true,
        },
      },
    },
  });
}

async function getStudentProfileByUserId(userId: number) {
  return prisma.student.findUnique({
    where: { userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      indexNumber: true,
      user: {
        select: {
          isActive: true,
        },
      },
    },
  });
}

async function resolveTeacherReference(referenceId: number) {
  const teacherByTeacherId = await prisma.teacher.findUnique({
    where: { id: referenceId },
    select: {
      id: true,
      userId: true,
      user: {
        select: {
          isActive: true,
        },
      },
    },
  });

  if (teacherByTeacherId) {
    if (!teacherByTeacherId.user?.isActive) {
      throw new AppError('Teacher is inactive.', 403);
    }

    return teacherByTeacherId;
  }

  const teacherByUserId = await prisma.teacher.findUnique({
    where: { userId: referenceId },
    select: {
      id: true,
      userId: true,
      user: {
        select: {
          isActive: true,
        },
      },
    },
  });

  if (teacherByUserId) {
    if (!teacherByUserId.user?.isActive) {
      throw new AppError('Teacher is inactive.', 403);
    }

    return teacherByUserId;
  }

  return null;
}

function buildSubjectResponse(subject: any, activeEnrollmentCount = 0, currentTeacherId?: number) {
  return {
    id: subject.id,
    name: subject.name,
    code: subject.code,
    feePerMonth: decimalToNumber(subject.feePerMonth),
    description: subject.description,
    teacherId: subject.teacherId,
    isActive: subject.isActive,
    createdAt: subject.createdAt,
    teacher: subject.teacher
      ? {
          id: subject.teacher.id,
          firstName: subject.teacher.firstName,
          lastName: subject.teacher.lastName,
          specialization: subject.teacher.specialization,
          isActive: subject.teacher.user?.isActive ?? true,
        }
      : null,
    activeEnrollmentCount,
    isAssignedToMe: currentTeacherId ? subject.teacherId === currentTeacherId : false,
  };
}

async function getActiveEnrollmentCountMap(subjectIds: number[]) {
  if (subjectIds.length === 0) {
    return new Map<number, number>();
  }

  const grouped = await prisma.enrollment.groupBy({
    by: ['subjectId'],
    where: {
      subjectId: { in: subjectIds },
      isActive: true,
    },
    _count: {
      _all: true,
    },
  });

  return new Map(grouped.map((item) => [item.subjectId, item._count._all]));
}

export class SubjectsService {
  static async createSubject(dto: CreateSubjectDto, actor?: { userId?: number }) {
    const teacher = await resolveTeacherReference(dto.teacherId);

    if (!teacher) {
      throw new AppError('Teacher not found. Use the teacher table id or the linked user id.', 404);
    }

    const subject = await prisma.subject.create({
      data: {
        name: dto.name,
        code: dto.code,
        feePerMonth: new Prisma.Decimal(dto.feePerMonth),
        teacherId: teacher.id,
        description: dto.description,
      },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                isActive: true,
              },
            },
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'SUBJECT_CREATED',
        userId: actor?.userId ?? null,
        resourceType: 'SUBJECT',
        resourceId: subject.id,
        details: JSON.stringify({
          name: subject.name,
          code: subject.code,
          feePerMonth: subject.feePerMonth.toString(),
          teacherId: subject.teacherId,
        }),
      },
    });

    return buildSubjectResponse(subject, 0);
  }

  static async getSubjects(params: SubjectsQueryParams) {
    const where: Prisma.SubjectWhereInput = {};

    if (params.userRole === UserRole.STUDENT && params.active === undefined) {
      where.isActive = true;
    } else if (params.active !== undefined) {
      where.isActive = params.active;
    }

    if (params.teacherId) {
      where.teacherId = params.teacherId;
    }

    if (params.code) {
      where.code = { equals: params.code, mode: 'insensitive' };
    }

    if (params.search) {
      where.code = { contains: params.search, mode: 'insensitive' };
    }

    const [subjects, currentTeacher] = await Promise.all([
      prisma.subject.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        include: {
          teacher: {
            include: {
              user: {
                select: {
                  isActive: true,
                },
              },
            },
          },
        },
      }),
      params.userRole === UserRole.TEACHER && params.userId ? getTeacherProfileByUserId(params.userId) : Promise.resolve(null),
    ]);

    const subjectIds = subjects.map((subject) => subject.id);
    const activeCounts = await getActiveEnrollmentCountMap(subjectIds);

    return {
      data: subjects.map((subject) =>
        buildSubjectResponse(subject, activeCounts.get(subject.id) ?? 0, currentTeacher?.id ?? undefined)
      ),
      total: subjects.length,
      page: 1,
      limit: subjects.length,
      hasMore: false,
    };
  }

  static async getSubjectByIdentifier(identifier: string, actor?: { userRole?: UserRole; userId?: number }) {
    const numericId = Number(identifier);
    let subject = Number.isInteger(numericId)
      ? await prisma.subject.findUnique({
          where: { id: numericId },
          include: {
            teacher: {
              include: {
                user: {
                  select: {
                    isActive: true,
                  },
                },
              },
            },
          },
        })
      : null;

    if (!subject) {
      subject = await prisma.subject.findUnique({
        where: { code: identifier },
        include: {
          teacher: {
            include: {
              user: {
                select: {
                  isActive: true,
                },
              },
            },
          },
        },
      });
    }

    if (!subject) {
      throw new AppError('Subject not found.', 404);
    }

    if (!subject.isActive && actor?.userRole === UserRole.STUDENT) {
      throw new AppError('Subject not found.', 404);
    }

    const activeEnrollmentCount = await prisma.enrollment.count({
      where: {
        subjectId: subject.id,
        isActive: true,
      },
    });

    const currentTeacher = actor?.userRole === UserRole.TEACHER && actor.userId
      ? await getTeacherProfileByUserId(actor.userId)
      : null;

    return buildSubjectResponse(subject, activeEnrollmentCount, currentTeacher?.id ?? undefined);
  }

  static async updateSubject(subjectId: number, dto: UpdateSubjectDto, actor?: { userId?: number }) {
    const existing = await prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!existing) {
      throw new AppError('Subject not found.', 404);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const data: Prisma.SubjectUpdateInput = {};

      if (dto.name !== undefined) {
        data.name = dto.name;
      }

      if (dto.code !== undefined) {
        data.code = dto.code;
      }

      if (dto.description !== undefined) {
        data.description = dto.description;
      }

      if (dto.feePerMonth !== undefined) {
        data.feePerMonth = new Prisma.Decimal(dto.feePerMonth);
      }

      const subject = await tx.subject.update({
        where: { id: subjectId },
        data,
        include: {
          teacher: {
            include: {
              user: {
                select: {
                  isActive: true,
                },
              },
            },
          },
        },
      });

      if (dto.feePerMonth !== undefined && decimalToNumber(existing.feePerMonth) !== dto.feePerMonth) {
        await tx.auditLog.create({
          data: {
            action: 'SUBJECT_FEE_UPDATED',
            userId: actor?.userId ?? null,
            resourceType: 'SUBJECT',
            resourceId: subject.id,
            details: JSON.stringify({
              previousFeePerMonth: existing.feePerMonth.toString(),
              newFeePerMonth: subject.feePerMonth.toString(),
            }),
          },
        });
      }

      return subject;
    });

    return buildSubjectResponse(updated, 0);
  }

  static async deactivateSubject(subjectId: number, actor?: { userId?: number; force?: boolean }) {
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject) {
      throw new AppError('Subject not found.', 404);
    }

    const activeEnrollmentCount = await prisma.enrollment.count({
      where: {
        subjectId,
        isActive: true,
      },
    });

    if (activeEnrollmentCount > 0 && !actor?.force) {
      throw new AppError('Cannot deactivate a subject with active enrollments. Use force=true as an admin.', 409);
    }

    const updated = await prisma.subject.update({
      where: { id: subjectId },
      data: {
        isActive: false,
      },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                isActive: true,
              },
            },
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'SUBJECT_DEACTIVATED',
        userId: actor?.userId ?? null,
        resourceType: 'SUBJECT',
        resourceId: subjectId,
        details: JSON.stringify({
          force: Boolean(actor?.force),
        }),
      },
    });

    return buildSubjectResponse(updated, activeEnrollmentCount);
  }

  static async assignTeacher(subjectId: number, teacherId: number, actor?: { userId?: number }) {
    const teacher = await resolveTeacherReference(teacherId);

    if (!teacher) {
      throw new AppError('Teacher not found. Use the teacher table id or the linked user id.', 404);
    }

    const subject = await prisma.subject.update({
      where: { id: subjectId },
      data: {
        teacherId,
      },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                isActive: true,
              },
            },
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'SUBJECT_TEACHER_ASSIGNED',
        userId: actor?.userId ?? null,
        resourceType: 'SUBJECT',
        resourceId: subjectId,
        details: JSON.stringify({
          teacherId,
        }),
      },
    });

    return buildSubjectResponse(subject, 0);
  }

  static async getSubjectStudents(subjectId: number, actor?: { userRole?: UserRole; userId?: number }) {
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      select: {
        id: true,
        teacherId: true,
      },
    });

    if (!subject) {
      throw new AppError('Subject not found.', 404);
    }

    if (actor?.userRole === UserRole.TEACHER && actor.userId) {
      const teacher = await getTeacherProfileByUserId(actor.userId);

      if (teacher?.id !== subject.teacherId) {
        throw new AppError('You can only view students for your assigned subjects.', 403);
      }
    }

    const enrollments = await prisma.enrollment.findMany({
      where: {
        subjectId,
        isActive: true,
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                isActive: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        enrolledAt: 'desc',
      },
    });

    return {
      data: enrollments.map((enrollment) => ({
        enrollmentId: enrollment.id,
        studentId: enrollment.studentId,
        enrolledAt: enrollment.enrolledAt,
        isActive: enrollment.isActive,
        student: {
          id: enrollment.student.id,
          userId: enrollment.student.userId,
          firstName: enrollment.student.firstName,
          lastName: enrollment.student.lastName,
          indexNumber: enrollment.student.indexNumber,
          phone: enrollment.student.phone,
          address: enrollment.student.address,
          isActive: enrollment.student.user?.isActive ?? true,
        },
      })),
      total: enrollments.length,
    };
  }

  static async enrollStudent(subjectId: number, dto: EnrollStudentDto, actor?: { userRole?: UserRole; userId?: number }) {
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!subject) {
      throw new AppError('Subject not found.', 404);
    }

    if (!subject.isActive) {
      throw new AppError('Cannot enroll students in an inactive subject.', 409);
    }

    let studentId = dto.studentId;

    if (actor?.userRole === UserRole.STUDENT) {
      if (!actor.userId) {
        throw new AppError('Student profile not found.', 403);
      }

      const student = await getStudentProfileByUserId(actor.userId);

      if (!student) {
        throw new AppError('Student profile not found.', 403);
      }

      studentId = student.id;
    }

    if (!studentId) {
      throw new AppError('Student ID is required for enrollment.', 400);
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        user: {
          select: {
            isActive: true,
          },
        },
      },
    });

    if (!student?.user.isActive) {
      throw new AppError('Student not found or is not active.', 404);
    }

    const existingEnrollment = await prisma.enrollment.findFirst({
      where: {
        studentId,
        subjectId,
      },
    });

    if (existingEnrollment?.isActive) {
      throw new AppError('Student is already enrolled in this subject.', 409);
    }

    const enrollment = existingEnrollment
      ? await prisma.enrollment.update({
          where: { id: existingEnrollment.id },
          data: { isActive: true },
        })
      : await prisma.enrollment.create({
          data: {
            studentId,
            subjectId,
            isActive: true,
          },
        });

    await prisma.auditLog.create({
      data: {
        action: 'SUBJECT_STUDENT_ENROLLED',
        userId: actor?.userId ?? null,
        resourceType: 'ENROLLMENT',
        resourceId: enrollment.id,
        details: JSON.stringify({
          subjectId,
          studentId,
        }),
      },
    });

    return enrollment;
  }

  static async unenrollStudent(subjectId: number, studentId: number, actor?: { userRole?: UserRole; userId?: number }) {
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      select: {
        id: true,
      },
    });

    if (!subject) {
      throw new AppError('Subject not found.', 404);
    }

    if (actor?.userRole === UserRole.STUDENT) {
      if (!actor.userId) {
        throw new AppError('Student profile not found.', 403);
      }

      const student = await getStudentProfileByUserId(actor.userId);

      if (student?.id !== studentId) {
        throw new AppError('You can only unenroll yourself.', 403);
      }
    }

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId,
        subjectId,
        isActive: true,
      },
    });

    if (!enrollment) {
      throw new AppError('Enrollment not found.', 404);
    }

    const updated = await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        action: 'SUBJECT_STUDENT_UNENROLLED',
        userId: actor?.userId ?? null,
        resourceType: 'ENROLLMENT',
        resourceId: updated.id,
        details: JSON.stringify({
          subjectId,
          studentId,
        }),
      },
    });

    return updated;
  }

  static async getEnrollmentCount(subjectId: number) {
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      select: { id: true },
    });

    if (!subject) {
      throw new AppError('Subject not found.', 404);
    }

    return prisma.enrollment.count({
      where: {
        subjectId,
        isActive: true,
      },
    });
  }
}

export default SubjectsService;