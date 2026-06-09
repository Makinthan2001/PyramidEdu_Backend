import { Prisma, Role, AuditAction, EnrollmentStatus, SubjectAllocationStatus } from '@prisma/client';
import prisma from '../../../config/prisma.config';
import { AppError } from '../../../utils/AppError';
import type { CreateSubjectDto } from '../dto/create-subject.dto';
import type { CreateStreamDto } from '../dto/create-stream.dto';
import type { UpdateSubjectDto } from '../dto/update-subject.dto';
import type { EnrollStudentDto } from '../dto/enroll-student.dto';

export interface SubjectsQueryParams {
  active?: boolean;
  teacherId?: string;
  streamId?: string;
  search?: string;
  userRole?: Role;
  userId?: string;
}

function generateSubjectCode(name: string) {
  const normalized = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return (normalized || 'SUBJECT').slice(0, 20);
}

async function ensureUniqueSubjectCode(baseCode: string) {
  let code = baseCode;
  let suffix = 1;

  while (await prisma.subject.findUnique({ where: { subjectCode: code } })) {
    const suffixText = String(suffix);
    code = `${baseCode.slice(0, Math.max(1, 20 - suffixText.length))}${suffixText}`;
    suffix += 1;
  }

  return code;
}

function decimalToNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === 'number' ? value : Number(value);
}

async function getTeacherProfileByUserId(userId: string) {
  return prisma.teacher.findUnique({
    where: { userId },
    select: {
      id: true,
      user: {
        select: {
          isActive: true,
        },
      },
    },
  });
}

async function getStudentProfileByUserId(userId: string) {
  return prisma.student.findUnique({
    where: { userId },
    select: {
      id: true,
      indexNumber: true,
      user: {
        select: {
          isActive: true,
        },
      },
    },
  });
}

async function resolveTeacherReference(referenceId: string) {
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

async function resolveStudentReference(referenceId: string) {
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
  // Try finding by UUID
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
  if (isUuid) {
    const subjectById = await prisma.subject.findUnique({
      where: { id: identifier },
      include: {
        streams: true,
        subjectAllocations: {
          where: { status: SubjectAllocationStatus.ACTIVE },
          include: {
            teacher: {
              include: {
                user: true,
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
    where: { subjectCode: identifier },
    include: {
      streams: true,
      subjectAllocations: {
        where: { status: SubjectAllocationStatus.ACTIVE },
        include: {
          teacher: {
            include: {
              user: true,
            },
          },
        },
      },
    },
  });
}

async function resolveEnrollmentStudentId(dto: EnrollStudentDto, actor?: { userRole?: Role; userId?: string }) {
  if (actor?.userRole === Role.STUDENT) {
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

function buildSubjectResponse(subject: any, activeEnrollmentCount = 0, currentTeacherId?: string) {
  // Get active teacher from allocations
  const activeAllocation = subject.subjectAllocations?.find((alloc: any) => alloc.status === SubjectAllocationStatus.ACTIVE);
  const teacher = activeAllocation?.teacher;

  // Support both streams[] (many-to-many) and legacy single stream
  const streamsArray: any[] = subject.streams ?? (subject.stream ? [subject.stream] : []);
  const primaryStream = streamsArray[0] ?? null;

  return {
    id: subject.id,
    name: subject.subjectName,
    code: subject.subjectCode,
    feePerMonth: decimalToNumber(subject.feeAmount),
    isActive: subject.isActive,
    createdAt: subject.createdAt,
    // Full array for multi-stream display
    streams: streamsArray.map((s: any) => ({
      id: s.id,
      name: s.streamName,
      isActive: s.isActive,
    })),
    // Legacy single-stream field for backwards compat
    stream: primaryStream
      ? {
        id: primaryStream.id,
        name: primaryStream.streamName,
        isActive: primaryStream.isActive,
      }
      : null,
    teacher: teacher
      ? {
        id: teacher.id,
        name: teacher.user?.fullName || '',
        isActive: teacher.user?.isActive ?? true,
      }
      : null,
    activeEnrollmentCount,
    isAssignedToMe: currentTeacherId && teacher ? teacher.id === currentTeacherId : false,
  };
}

async function getActiveEnrollmentCountMap(subjectIds: string[]) {
  if (subjectIds.length === 0) {
    return new Map<string, number>();
  }

  const grouped = await prisma.enrollment.groupBy({
    by: ['subjectId'],
    where: {
      subjectId: { in: subjectIds },
      enrollmentStatus: EnrollmentStatus.ACTIVE,
    },
    _count: {
      _all: true,
    },
  });

  return new Map(grouped.map((item) => [item.subjectId, item._count._all]));
}

export class SubjectsService {
  static async getStreams() {
    return prisma.stream.findMany({
      where: { isActive: true },
      orderBy: { streamName: 'asc' },
      include: {
        batches: true,
      },
    });
  }

  static async getAvailableSubjects() {
    const subjects = await prisma.subject.findMany({
      where: { isActive: true },
      orderBy: { subjectName: 'asc' },
      include: {
        streams: true,
      },
    });

    return subjects.map((sub) => ({
      id: sub.id,
      name: sub.subjectName,
      streamName: sub.streams[0]?.streamName ?? '',
      streams: sub.streams.map(s => ({ id: s.id, name: s.streamName, streamName: s.streamName })),
      feePerMonth: decimalToNumber(sub.feeAmount),
    }));
  }

  static async createStream(dto: CreateStreamDto, actor?: { userId?: string }) {
    const stream = await prisma.stream.create({
      data: {
        streamName: dto.name,
        batches: dto.batchIds && dto.batchIds.length > 0 ? {
          connect: dto.batchIds.map(id => ({ id }))
        } : undefined,
      },
      include: {
        batches: true,
      },
    });

    if (actor?.userId) {
      await prisma.auditLog.create({
        data: {
          action: AuditAction.CREATE,
          userId: actor.userId,
          module: 'STREAM',
          description: `Stream created: ${stream.streamName}`,
        },
      });
    }

    return stream;
  }

  static async updateStream(streamId: string, streamName: string, batchIds?: string[]) {
    return prisma.stream.update({
      where: { id: streamId },
      data: { 
        streamName,
        batches: batchIds ? {
          set: batchIds.map(id => ({ id }))
        } : undefined
      },
      include: {
        batches: true
      }
    });
  }

  static async createSubject(dto: CreateSubjectDto, actor?: { userId?: string }) {
    const requestedCode = dto.subjectCode ? dto.subjectCode.toUpperCase() : generateSubjectCode(dto.subjectName);
    const code = await ensureUniqueSubjectCode(requestedCode);

    // Resolve stream IDs from either streamIds array or single streamId
    const streamIds = dto.streamIds?.length ? dto.streamIds : (dto.streamId ? [dto.streamId] : []);

    const subject = await prisma.subject.create({
      data: {
        subjectName: dto.subjectName,
        subjectCode: code,
        feeAmount: new Prisma.Decimal(dto.feeAmount),
        isActive: dto.isActive ?? true,
        streams: streamIds.length > 0 ? {
          connect: streamIds.map((id) => ({ id })),
        } : undefined,
      },
      include: {
        streams: true,
        subjectAllocations: {
          include: {
            teacher: {
              include: { user: true },
            },
          },
        },
      },
    });

    if (actor?.userId) {
      await prisma.auditLog.create({
        data: {
          action: AuditAction.CREATE,
          userId: actor.userId,
          module: 'SUBJECT',
          description: `Subject created: ${subject.subjectName} (${subject.subjectCode})`,
        },
      });
    }

    return buildSubjectResponse(subject, 0);
  }

  static async getSubjects(params: SubjectsQueryParams) {
    const where: Prisma.SubjectWhereInput = {};

    if (params.userRole === Role.STUDENT && params.active === undefined) {
      where.isActive = true;
    } else if (params.active !== undefined) {
      where.isActive = params.active;
    }

    if (params.teacherId) {
      where.subjectAllocations = {
        some: {
          teacherId: params.teacherId,
          status: SubjectAllocationStatus.ACTIVE,
        },
      };
    }

    if (params.streamId) {
      where.streams = { some: { id: params.streamId } };
    }

    if (params.search) {
      where.OR = [
        { subjectName: { contains: params.search, mode: 'insensitive' } },
        { subjectCode: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    try {
      const [subjects, currentTeacher] = await Promise.all([
        prisma.subject.findMany({
          where,
          orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
          include: {
            streams: true,
            subjectAllocations: {
              include: {
                teacher: {
                  include: {
                    user: {
                      select: {
                        isActive: true,
                        fullName: true,
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        params.userRole === Role.TEACHER && params.userId ? getTeacherProfileByUserId(params.userId) : Promise.resolve(null),
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
    } catch (err: any) {
      console.error('[getSubjects] Prisma/DB error:', err?.message ?? err);
      throw err;
    }
  }



  static async getSubjectByIdentifier(identifier: string, actor?: { userRole?: Role; userId?: string }) {
    const subject = await findSubjectByIdentifier(identifier);

    if (!subject) {
      throw new AppError('Subject not found.', 404);
    }

    if (!subject.isActive && actor?.userRole === Role.STUDENT) {
      throw new AppError('Subject not found.', 404);
    }

    const activeEnrollmentCount = await prisma.enrollment.count({
      where: {
        subjectId: subject.id,
        enrollmentStatus: EnrollmentStatus.ACTIVE,
      },
    });

    const currentTeacher = actor?.userRole === Role.TEACHER && actor.userId
      ? await getTeacherProfileByUserId(actor.userId)
      : null;

    return buildSubjectResponse(subject, activeEnrollmentCount, currentTeacher?.id ?? undefined);
  }

  static async updateSubject(subjectId: string, dto: UpdateSubjectDto, actor?: { userId?: string }) {
    const existing = await prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!existing) {
      throw new AppError('Subject not found.', 404);
    }

    const data: Prisma.SubjectUpdateInput = {};

    if (dto.subjectName !== undefined) {
      data.subjectName = dto.subjectName;
    }

    if (dto.subjectCode !== undefined) {
      data.subjectCode = dto.subjectCode;
    }

    if (dto.feeAmount !== undefined) {
      data.feeAmount = new Prisma.Decimal(dto.feeAmount);
    }

    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    if (dto.streamId !== undefined || dto.streamIds !== undefined) {
      // Resolve stream IDs from either streamIds array or single streamId
      const streamIds = dto.streamIds?.length ? dto.streamIds : (dto.streamId ? [dto.streamId] : []);
      if (streamIds.length > 0) {
        data.streams = { set: streamIds.map((id) => ({ id })) };
      }
    }

    const updated = await prisma.subject.update({
      where: { id: subjectId },
      data,
      include: {
        streams: true,
        subjectAllocations: {
          include: {
            teacher: {
              include: {
                user: {
                  select: {
                    isActive: true,
                    fullName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (actor?.userId) {
      await prisma.auditLog.create({
        data: {
          action: AuditAction.UPDATE,
          userId: actor.userId,
          module: 'SUBJECT',
          description: `Subject updated: ${updated.subjectName}`,
        },
      });
    }

    return buildSubjectResponse(updated, 0);
  }

  static async deactivateSubject(subjectId: string, actor?: { userId?: string; force?: boolean }) {
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject) {
      throw new AppError('Subject not found.', 404);
    }

    const activeEnrollmentCount = await prisma.enrollment.count({
      where: {
        subjectId,
        enrollmentStatus: EnrollmentStatus.ACTIVE,
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
        streams: true,
        subjectAllocations: {
          include: {
            teacher: {
              include: {
                user: {
                  select: {
                    isActive: true,
                    fullName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (actor?.userId) {
      await prisma.auditLog.create({
        data: {
          action: AuditAction.UPDATE,
          userId: actor.userId,
          module: 'SUBJECT',
          description: `Subject deactivated: ${subjectId}`,
        },
      });
    }

    return buildSubjectResponse(updated, activeEnrollmentCount);
  }

  static async assignTeacher(subjectId: string, teacherId: string, batchIds?: string[], actor?: { userId?: string }) {
    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) {
      throw new AppError('Subject not found.', 404);
    }

    const teacher = await resolveTeacherReference(teacherId);
    if (!teacher) {
      throw new AppError('Teacher not found.', 404);
    }

    // Allocate teacher using SubjectAllocation
    await prisma.subjectAllocation.upsert({
      where: {
        teacherId_subjectId: {
          teacherId: teacher.id,
          subjectId,
        },
      },
      create: {
        teacherId: teacher.id,
        subjectId,
        status: SubjectAllocationStatus.ACTIVE,
        ...(batchIds && {
          batches: {
            connect: batchIds.map((id) => ({ id })),
          },
        }),
      },
      update: {
        status: SubjectAllocationStatus.ACTIVE,
        ...(batchIds && {
          batches: {
            set: batchIds.map((id) => ({ id })),
          },
        }),
      },
    });

    if (actor?.userId) {
      await prisma.auditLog.create({
        data: {
          action: AuditAction.UPDATE,
          userId: actor.userId,
          module: 'SUBJECT',
          description: `Teacher ${teacher.id} assigned to subject ${subject.subjectName}`,
        },
      });
    }

    const updatedSubject = await prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        streams: true,
        subjectAllocations: {
          include: {
            teacher: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    return buildSubjectResponse(updatedSubject, 0);
  }

  static async getSubjectTeachers(subjectId: string) {
    const allocations = await prisma.subjectAllocation.findMany({
      where: { subjectId, status: SubjectAllocationStatus.ACTIVE },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                isActive: true,
                profileImage: true,
              }
            }
          }
        }
      }
    });

    return allocations.map(a => a.teacher);
  }

  static async getSubjectStudents(subjectId: string, actor?: { userRole?: Role; userId?: string }) {
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      select: {
        id: true,
      },
    });

    if (!subject) {
      throw new AppError('Subject not found.', 404);
    }

    if (actor?.userRole === Role.TEACHER && actor.userId) {
      const teacher = await getTeacherProfileByUserId(actor.userId);
      // Ensure the teacher is allocated to this subject
      const allocation = await prisma.subjectAllocation.findFirst({
        where: {
          subjectId,
          teacherId: teacher?.id,
          status: SubjectAllocationStatus.ACTIVE,
        },
      });

      if (!allocation) {
        throw new AppError('You can only view students for your assigned subjects.', 403);
      }
    }

    const enrollments = await prisma.enrollment.findMany({
      where: {
        subjectId,
        enrollmentStatus: EnrollmentStatus.ACTIVE,
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                isActive: true,
                email: true,
                fullName: true,
              },
            },
          },
        },
      },
      orderBy: {
        enrolledDate: 'desc',
      },
    });

    return {
      data: enrollments.map((enrollment) => ({
        enrollmentId: enrollment.id,
        studentId: enrollment.studentId,
        enrolledAt: enrollment.enrolledDate,
        enrollmentStatus: enrollment.enrollmentStatus,
        student: {
          id: enrollment.student.id,
          userId: enrollment.student.userId,
          name: enrollment.student.user?.fullName || '',
          indexNumber: enrollment.student.indexNumber,
          phone: enrollment.student.phone,
          address: enrollment.student.address,
          isActive: enrollment.student.user?.isActive ?? true,
        },
      })),
      total: enrollments.length,
    };
  }

  static async enrollStudent(subjectId: string, dto: EnrollStudentDto, actor?: { userRole?: Role; userId?: string }) {
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
        enrollmentStatus: EnrollmentStatus.ACTIVE,
      },
    });

    if (existingEnrollment?.enrollmentStatus === EnrollmentStatus.ACTIVE) {
      throw new AppError('Student is already enrolled in this subject.', 409);
    }

    const enrollment = existingEnrollment
      ? await prisma.enrollment.update({
        where: { id: existingEnrollment.id },
        data: { enrollmentStatus: EnrollmentStatus.ACTIVE },
      })
      : await prisma.enrollment.create({
        data: {
          studentId,
          subjectId,
          enrollmentStatus: EnrollmentStatus.ACTIVE,
        },
      });

    if (actor?.userId) {
      await prisma.auditLog.create({
        data: {
          action: AuditAction.CREATE,
          userId: actor.userId,
          module: 'ENROLLMENT',
          description: `Student ${studentId} enrolled in subject ${subjectId}`,
        },
      });
    }

    return enrollment;
  }

  static async unenrollStudent(subjectId: string, studentId: string, actor?: { userRole?: Role; userId?: string }) {
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      select: {
        id: true,
      },
    });

    if (!subject) {
      throw new AppError('Subject not found.', 404);
    }

    if (actor?.userRole === Role.STUDENT) {
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
        enrollmentStatus: EnrollmentStatus.ACTIVE,
      },
    });

    if (!enrollment || enrollment.enrollmentStatus !== EnrollmentStatus.ACTIVE) {
      throw new AppError('Active enrollment not found.', 404);
    }

    const updated = await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { enrollmentStatus: EnrollmentStatus.DROPPED },
    });

    if (actor?.userId) {
      await prisma.auditLog.create({
        data: {
          action: AuditAction.UPDATE,
          userId: actor.userId,
          module: 'ENROLLMENT',
          description: `Student ${studentId} unenrolled from subject ${subjectId}`,
        },
      });
    }

    return updated;
  }

  static async getEnrollmentCount(subjectId: string) {
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
        enrollmentStatus: EnrollmentStatus.ACTIVE,
      },
    });
  }
}

export default SubjectsService;