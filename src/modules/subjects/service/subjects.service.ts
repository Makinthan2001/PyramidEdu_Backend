import { Prisma, UserRole } from '@prisma/client';
import prisma from '../../../config/prisma.config';
import { AppError } from '../../../utils/AppError';
import type { CreateSubjectDto } from '../dto/create-subject.dto';
import type { CreateStreamDto } from '../dto/create-stream.dto';
import type { UpdateSubjectDto } from '../dto/update-subject.dto';
import type { EnrollStudentDto } from '../dto/enroll-student.dto';

export interface SubjectsQueryParams {
  active?: boolean;
  teacherId?: number;
  streamId?: number;
  search?: string;
  userRole?: UserRole;
  userId?: number;
}

function generateSubjectCode(name: string) {
  const normalized = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return (normalized || 'SUBJECT').slice(0, 20);
}

async function ensureUniqueSubjectCode(baseCode: string) {
  let code = baseCode;
  let suffix = 1;

  while (await prisma.subject.findUnique({ where: { code } })) {
    const suffixText = String(suffix);
    code = `${baseCode.slice(0, Math.max(1, 20 - suffixText.length))}${suffixText}`;
    suffix += 1;
  }

  return code;
}

async function validateStreamIds(streamIds: number[]) {
  const uniqueIds = Array.from(new Set(streamIds));

  if (uniqueIds.length === 0) {
    throw new AppError('At least one stream is required.', 400);
  }

  const streams = await prisma.stream.findMany({
    where: {
      id: { in: uniqueIds },
      isActive: true,
    },
    select: { id: true },
  });

  if (streams.length !== uniqueIds.length) {
    throw new AppError('One or more selected streams were not found.', 404);
  }

  return uniqueIds;
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

async function resolveStudentReference(referenceId: number) {
  const studentByStudentId = await prisma.student.findUnique({
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

  if (studentByStudentId) {
    if (!studentByStudentId.user?.isActive) {
      throw new AppError('Student is inactive.', 403);
    }

    return studentByStudentId;
  }

  const studentByUserId = await prisma.student.findUnique({
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

  if (studentByUserId) {
    if (!studentByUserId.user?.isActive) {
      throw new AppError('Student is inactive.', 403);
    }

    return studentByUserId;
  }

  return null;
}

async function findSubjectByIdentifier(identifier: string) {
  const numericId = Number(identifier);

  if (Number.isInteger(numericId)) {
    const subjectById = await prisma.subject.findUnique({
      where: { id: numericId },
      include: {
        subjectStreams: {
          include: {
            stream: true,
          },
        },
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

    if (subjectById) {
      return subjectById;
    }
  }

  return prisma.subject.findUnique({
    where: { code: identifier },
    include: {
      subjectStreams: {
        include: {
          stream: true,
        },
      },
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

async function resolveEnrollmentStudentId(dto: EnrollStudentDto, actor?: { userRole?: UserRole; userId?: number }) {
  if (actor?.userRole === UserRole.STUDENT) {
    if (!actor.userId) {
      throw new AppError('Student profile not found.', 403);
    }

    const student = await getStudentProfileByUserId(actor.userId);

    if (!student) {
      throw new AppError('Student profile not found.', 403);
    }

    return student.id;
  }

  if (dto.studentId) {
    return dto.studentId;
  }

  if (dto.userId) {
    const student = await resolveStudentReference(dto.userId);

    if (!student) {
      throw new AppError('Student profile not found.', 403);
    }

    return student.id;
  }

  throw new AppError('Student ID is required for enrollment.', 400);
}

function buildSubjectResponse(subject: any, activeEnrollmentCount = 0, currentTeacherId?: number) {
  return {
    id: subject.id,
    name: subject.name,
    feePerMonth: decimalToNumber(subject.feePerMonth),
    description: subject.description,
    teacherId: subject.teacherId,
    isActive: subject.isActive,
    createdAt: subject.createdAt,
    streams: (subject.subjectStreams ?? []).map((subjectStream: any) => ({
      id: subjectStream.stream.id,
      name: subjectStream.stream.name,
      isActive: subjectStream.stream.isActive,
    })),
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
  static async getStreams() {
    const streams = await prisma.stream.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return streams;
  }

  static async getAvailableSubjects() {
    const subjects = await prisma.subject.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        subjectStreams: {
          include: {
            stream: true,
          },
        },
      },
    });

    return subjects.map((sub) => ({
      id: sub.id,
      name: sub.name,
      streams: (sub.subjectStreams ?? []).map((ss) => ss.stream.name),
      feePerMonth: decimalToNumber(sub.feePerMonth),
    }));
  }

  static async createStream(dto: CreateStreamDto, actor?: { userId?: number }) {
    const stream = await prisma.stream.create({
      data: {
        name: dto.name,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'STREAM_CREATED',
        userId: actor?.userId ?? null,
        resourceType: 'STREAM',
        resourceId: stream.id,
        details: JSON.stringify({ name: stream.name }),
      },
    });

    return stream;
  }

  static async createSubject(dto: CreateSubjectDto, actor?: { userId?: number }) {
    const streamIds = await validateStreamIds(dto.streamIds);
    const requestedCode = dto.code ? dto.code.toUpperCase() : generateSubjectCode(dto.name);
    const code = await ensureUniqueSubjectCode(requestedCode);

    const subject = await prisma.subject.create({
      data: {
        name: dto.name,
        code,
        feePerMonth: new Prisma.Decimal(dto.feePerMonth),
        description: dto.description,
        isActive: dto.isActive ?? true,
        subjectStreams: {
          createMany: {
            data: streamIds.map((streamId) => ({ streamId })),
          },
        },
      },
      include: {
        subjectStreams: {
          include: {
            stream: true,
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

    if (params.streamId) {
      where.subjectStreams = {
        some: {
          streamId: params.streamId,
        },
      };
    }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { code: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [subjects, currentTeacher] = await Promise.all([
      prisma.subject.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        include: {
          subjectStreams: {
            include: {
              stream: true,
            },
          },
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

  static async getSubjectTeachers(subjectId: number) {
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
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
        materials: {
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
        },
      },
    });

    if (!subject) {
      throw new AppError('Subject not found.', 404);
    }

    const teachersById = new Map<number, { id: number; name: string; qualification: string; isActive: boolean }>();

    const subjectTeachers = await prisma.teacher.findMany({
      where: {
        specialization: {
          equals: subject.name,
          mode: 'insensitive',
        },
        user: {
          isActive: true,
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        specialization: true,
        user: {
          select: {
            isActive: true,
          },
        },
      },
      orderBy: {
        firstName: 'asc',
      },
    });

    for (const teacher of subjectTeachers) {
      teachersById.set(teacher.id, {
        id: teacher.id,
        name: `${teacher.firstName ?? ''} ${teacher.lastName ?? ''}`.trim(),
        qualification: teacher.specialization ?? '',
        isActive: teacher.user?.isActive ?? true,
      });
    }

    if (subject.teacher) {
      teachersById.set(subject.teacher.id, {
        id: subject.teacher.id,
        name: `${subject.teacher.firstName ?? ''} ${subject.teacher.lastName ?? ''}`.trim(),
        qualification: subject.teacher.specialization ?? '',
        isActive: subject.teacher.user?.isActive ?? true,
      });
    }

    for (const material of subject.materials ?? []) {
      const teacher = material.teacher;
      if (!teacher || teachersById.has(teacher.id)) {
        continue;
      }

      teachersById.set(teacher.id, {
        id: teacher.id,
        name: `${teacher.firstName ?? ''} ${teacher.lastName ?? ''}`.trim(),
        qualification: teacher.specialization ?? '',
        isActive: teacher.user?.isActive ?? true,
      });
    }

    return Array.from(teachersById.values());
  }

  static async getSubjectByIdentifier(identifier: string, actor?: { userRole?: UserRole; userId?: number }) {
    const subject = await findSubjectByIdentifier(identifier);

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

    const streamIds = dto.streamIds === undefined
      ? undefined
      : await validateStreamIds(dto.streamIds);

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

      if (dto.isActive !== undefined) {
        data.isActive = dto.isActive;
      }

      await tx.subject.update({
        where: { id: subjectId },
        data,
        include: {
          subjectStreams: {
            include: {
              stream: true,
            },
          },
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

      if (streamIds !== undefined) {
        await tx.subjectStream.deleteMany({
          where: { subjectId },
        });

        await tx.subjectStream.createMany({
          data: streamIds.map((streamId) => ({
            subjectId,
            streamId,
          })),
        });
      }

      const refreshed = await tx.subject.findUnique({
        where: { id: subjectId },
        include: {
          subjectStreams: {
            include: {
              stream: true,
            },
          },
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

      if (!refreshed) {
        throw new AppError('Subject not found.', 404);
      }

      return refreshed;
    });

    if (dto.feePerMonth !== undefined && decimalToNumber(existing.feePerMonth) !== dto.feePerMonth) {
      await prisma.auditLog.create({
        data: {
          action: 'SUBJECT_FEE_UPDATED',
          userId: actor?.userId ?? null,
          resourceType: 'SUBJECT',
          resourceId: updated.id,
          details: JSON.stringify({
            previousFeePerMonth: existing.feePerMonth.toString(),
            newFeePerMonth: updated.feePerMonth.toString(),
          }),
        },
      });
    }

    if (dto.isActive !== undefined && existing.isActive !== dto.isActive) {
      await prisma.auditLog.create({
        data: {
          action: dto.isActive ? 'SUBJECT_ACTIVATED' : 'SUBJECT_DEACTIVATED',
          userId: actor?.userId ?? null,
          resourceType: 'SUBJECT',
          resourceId: updated.id,
          details: JSON.stringify({
            previousIsActive: existing.isActive,
            newIsActive: dto.isActive,
          }),
        },
      });
    }

    if (streamIds !== undefined) {
      await prisma.auditLog.create({
        data: {
          action: 'SUBJECT_STREAMS_UPDATED',
          userId: actor?.userId ?? null,
          resourceType: 'SUBJECT',
          resourceId: updated.id,
          details: JSON.stringify({
            streamIds,
          }),
        },
      });
    }

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
        subjectStreams: {
          include: {
            stream: true,
          },
        },
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

  static async assignTeacher(subjectIdentifier: string | number, teacherId: number, actor?: { userId?: number }) {
    // Resolve subject by ID or code
    const subject = typeof subjectIdentifier === 'string' && Number.isNaN(Number(subjectIdentifier))
      ? await prisma.subject.findUnique({ where: { code: subjectIdentifier }, select: { id: true } })
      : await prisma.subject.findUnique({ where: { id: Number(subjectIdentifier) }, select: { id: true } });
    if (!subject) {
      throw new AppError('Subject not found.', 404);
    }

    const teacher = await resolveTeacherReference(teacherId);

    if (!teacher) {
      throw new AppError('Teacher not found. Use the teacher table id or the linked user id.', 404);
    }

    const updatedSubject = await prisma.subject.update({
      where: { id: subject.id },
      data: {
        teacherId: teacher.id,
      },
      include: {
        subjectStreams: {
          include: { stream: true },
        },
        teacher: {
          include: { user: { select: { isActive: true } } },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'SUBJECT_TEACHER_ASSIGNED',
        userId: actor?.userId ?? null,
        resourceType: 'SUBJECT',
        resourceId: subject.id,
        details: JSON.stringify({ teacherId: teacher.id }),
      },
    });

    return buildSubjectResponse(updatedSubject, 0);
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

    const studentId = await resolveEnrollmentStudentId(dto, actor);

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