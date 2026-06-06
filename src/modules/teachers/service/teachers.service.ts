import prisma from '../../../config/prisma.config';
import { Prisma, Role, AuditAction } from '@prisma/client';
import { Teacher as CustomTeacher } from '../types/teacher.types';
import { hashPassword } from '../../../utils/password.util';
import { AppError } from '../../../utils/AppError';
import { CreateTeacherDto, UpdateTeacherDto, AssignSubjectDto } from '../dto/index';

/**
 * Service layer for Teacher entity.
 */
export class TeachersService {
  static async getTeachers(params: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ data: CustomTeacher[]; total: number }> {
    const { page = 1, limit = 10, search } = params;
    const where: Prisma.TeacherWhereInput = {
      deletedAt: null,
    };
    
    if (search) {
      where.OR = [
        { user: { fullName: { contains: search, mode: 'insensitive' } } },
        { nic: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    const [data, total] = await Promise.all([
      prisma.teacher.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { user: true },
      }),
      prisma.teacher.count({ where }),
    ]);
    return { data, total };
  }

  static async getTeacherById(id: string): Promise<any | null> {
    return prisma.teacher.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: true,
        subjectAllocations: {
          include: {
            subject: true,
          },
        },
      },
    });
  }

  static async getTeacherByUserId(userId: string): Promise<any | null> {
    return prisma.teacher.findFirst({
      where: { userId, deletedAt: null },
      include: {
        user: true,
        subjectAllocations: {
          include: {
            subject: true,
          },
        },
      },
    });
  }

  static async createTeacher(dto: CreateTeacherDto): Promise<CustomTeacher> {
    const existingUser = await prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });

    if (existingUser) {
      throw new AppError('Email already in use.', 409);
    }

    const hashedPassword = await hashPassword(dto.password || 'TempPass123!');
    
    const user = await prisma.user.create({
      data: {
        email: dto.email.trim().toLowerCase(),
        password: hashedPassword,
        fullName: dto.fullName,
        role: Role.TEACHER,
        isActive: true,
      },
    });

    const teacher = await prisma.teacher.create({
      data: {
        userId: user.id,
        subjectId: dto.subjectId || null,
        nic: dto.nic,
        gender: dto.gender,
        address: dto.address,
        phone: dto.phone || null,
        salary: dto.salary ? new Prisma.Decimal(dto.salary) : null,
      },
      include: { user: true },
    });

    await prisma.auditLog.create({
      data: {
        action: AuditAction.CREATE,
        userId: user.id,
        module: 'TEACHER',
        description: `Teacher profile created for ${user.email}`,
      },
    });

    return teacher;
  }

  static async updateTeacher(id: string, dto: UpdateTeacherDto): Promise<any> {
    const teacher = await prisma.teacher.findFirst({
      where: { id, deletedAt: null },
    });

    if (!teacher) {
      throw new AppError('Teacher not found', 404);
    }

    const teacherData: Prisma.TeacherUpdateInput = {};
    if (dto.phone !== undefined) teacherData.phone = dto.phone;
    if (dto.address !== undefined) teacherData.address = dto.address;
    if (dto.salary !== undefined) teacherData.salary = dto.salary ? new Prisma.Decimal(dto.salary) : null;
    if (dto.subjectId !== undefined) teacherData.subjectId = dto.subjectId;
    if (dto.nic !== undefined) teacherData.nic = dto.nic;
    if (dto.gender !== undefined) teacherData.gender = dto.gender;

    if (Object.keys(teacherData).length > 0) {
      await prisma.teacher.update({
        where: { id },
        data: teacherData,
      });
    }

    if (dto.fullName) {
      await prisma.user.update({
        where: { id: teacher.userId },
        data: { fullName: dto.fullName },
      });
    }

    await prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        userId: teacher.userId,
        module: 'TEACHER',
        description: `Teacher profile updated`,
      },
    });

    return prisma.teacher.findUnique({
      where: { id },
      include: { user: true },
    });
  }

  static async deleteTeacher(id: string): Promise<CustomTeacher> {
    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!teacher) throw new AppError('Teacher not found', 404);

    await prisma.$transaction([
      prisma.teacher.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: teacher.userId },
        data: { isActive: false },
      }),
    ]);

    await prisma.auditLog.create({
      data: {
        action: AuditAction.DELETE,
        userId: teacher.userId,
        module: 'TEACHER',
        description: `Teacher soft deleted and user deactivated`,
      },
    });

    return teacher;
  }

  static async assignSubject(teacherId: string, dto: AssignSubjectDto): Promise<void> {
    await prisma.subjectAllocation.upsert({
      where: {
        teacherId_subjectId: {
          teacherId,
          subjectId: dto.subjectId,
        },
      },
      create: {
        teacherId,
        subjectId: dto.subjectId,
        status: 'ACTIVE',
      },
      update: {
        status: 'ACTIVE',
      },
    });
  }

  static async removeSubject(teacherId: string, dto: AssignSubjectDto): Promise<void> {
    await prisma.subjectAllocation.delete({
      where: {
        teacherId_subjectId: {
          teacherId,
          subjectId: dto.subjectId,
        },
      },
    });
  }
}

export default TeachersService;
