import prisma from '../../../config/prisma.config';
import { Prisma } from '@prisma/client';
import { Teacher as CustomTeacher } from '../types/teacher.types';



import { CreateTeacherDto, UpdateTeacherDto, AssignSubjectDto } from '../dto/index';

/**
 * Service layer for Teacher entity. Mirrors the pattern used in other services.
 */
export class TeachersService {
  static async getTeachers(params: {
    page?: number;
    limit?: number;
    search?: string;
    specialization?: string;
  }): Promise<{ data: CustomTeacher[]; total: number }> {
    const { page = 1, limit = 10, search, specialization } = params;
    const where: Prisma.TeacherWhereInput = {};
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { specialization: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (specialization) {
      where.specialization = { equals: specialization, mode: 'insensitive' };
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

  static async getTeacherById(id: number): Promise<CustomTeacher & { subjects?: any[] } | null> {
    return prisma.teacher.findUnique({
      where: { id },
      include: { user: true, subjects: true },
    });
  }

  static async createTeacher(dto: CreateTeacherDto): Promise<CustomTeacher> {
    const user = await prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: dto.password ?? '',
        role: 'TEACHER',
        isActive: true,
      },
    });
    const teacher = await prisma.teacher.create({
      data: {
        userId: user.id,
        firstName: dto.firstName,
        lastName: dto.lastName,
        nicNumber: dto.nicNumber,
        gender: dto.gender,
        address: dto.address,
        phone: dto.phone ?? '',
        specialization: dto.specialization,
        salary: dto.salary ? new Prisma.Decimal(dto.salary) : undefined,
      },
    });
    return teacher;
  }

  static async updateTeacher(id: number, dto: UpdateTeacherDto): Promise<CustomTeacher> {
    const data: Prisma.TeacherUpdateInput = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.specialization !== undefined) data.specialization = dto.specialization;
    if (dto.salary !== undefined) data.salary = dto.salary ? new Prisma.Decimal(dto.salary) : null;
    const teacher = await prisma.teacher.update({ where: { id }, data });
    return teacher;
  }

  static async deleteTeacher(id: number): Promise<CustomTeacher> {
    const teacher = await prisma.teacher.findUnique({ where: { id }, include: { user: true } });
    if (!teacher) throw new Error('Teacher not found');
    await prisma.user.update({ where: { id: teacher.userId }, data: { isActive: false } });
    return teacher;
  }

  static async assignSubject(teacherId: number, dto: AssignSubjectDto): Promise<void> {
    await prisma.subject.update({
      where: { id: dto.subjectId },
      data: { teacherId },
    });
  }

  static async removeSubject(teacherId: number, dto: AssignSubjectDto): Promise<void> {
    const subject = await prisma.subject.findUnique({ where: { id: dto.subjectId } });
    if (subject?.teacherId !== teacherId) throw new Error('Subject not assigned to this teacher');
    await prisma.subject.update({ where: { id: dto.subjectId }, data: { teacherId: null } });
  }
}

export default TeachersService;
