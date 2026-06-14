import prisma from '../../../config/prisma.config';
import { Prisma, Gender } from '@prisma/client';
import { AppError } from '../../../utils/AppError';
import { CreateSupportStaffDto, UpdateSupportStaffDto } from '../dto/index';

export class SupportStaffService {
  static async getSupportStaff(params: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.SupportStaffWhereInput = {
      deletedAt: null,
    };

    if (params.search) {
      where.OR = [
        { staffName: { contains: params.search, mode: 'insensitive' } },
        { nic: { contains: params.search, mode: 'insensitive' } },
        { phone: { contains: params.search, mode: 'insensitive' } },
        { roleType: { contains: params.search, mode: 'insensitive' } },
        { department: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.supportStaff.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.supportStaff.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      hasMore: skip + data.length < total,
    };
  }

  static async getSupportStaffById(id: string) {
    const staff = await prisma.supportStaff.findFirst({
      where: { id, deletedAt: null },
    });

    if (!staff) {
      throw new AppError('Support staff member not found.', 404);
    }

    return staff;
  }

  static async createSupportStaff(dto: CreateSupportStaffDto) {
    // Check unique NIC
    if (dto.nicNumber) {
      const existingNic = await prisma.supportStaff.findUnique({
        where: { nic: dto.nicNumber },
      });
      if (existingNic) {
        throw new AppError('NIC is already registered for another staff member.', 409);
      }
    }

    // Auto-generate staff code if not provided
    const staffCode = dto.staffCode || `SS-${Date.now()}`;
    const staffName = `${dto.firstName} ${dto.lastName}`.trim();

    const staff = await prisma.supportStaff.create({
      data: {
        staffCode,
        staffName,
        position: dto.position || null,
        department: dto.department || null,
        salary: dto.salary ? new Prisma.Decimal(dto.salary) : null,
        hirDate: dto.hireDate ? new Date(dto.hireDate) : new Date(),
        address: dto.address || null,
        phone: dto.phoneNumber || null,
        nic: dto.nicNumber,
        roleType: dto.roleType || null,
        gender: dto.gender as Gender,
        isActive: true,
      },
    });

    return staff;
  }

  static async updateSupportStaff(id: string, dto: UpdateSupportStaffDto) {
    const staff = await prisma.supportStaff.findFirst({
      where: { id, deletedAt: null },
    });

    if (!staff) {
      throw new AppError('Support staff member not found.', 404);
    }

    // Check NIC unique constraints
    if (dto.nicNumber && dto.nicNumber !== staff.nic) {
      const existingNic = await prisma.supportStaff.findUnique({
        where: { nic: dto.nicNumber },
      });
      if (existingNic) {
        throw new AppError('NIC is already registered for another staff member.', 409);
      }
    }

    const updateData: Prisma.SupportStaffUpdateInput = {};

    // Name construction logic if names are provided
    if (dto.firstName || dto.lastName) {
      const currentParts = staff.staffName.split(' ');
      const existingFirst = currentParts[0] || '';
      const existingLast = currentParts.slice(1).join(' ') || '';
      const firstName = dto.firstName !== undefined ? dto.firstName : existingFirst;
      const lastName = dto.lastName !== undefined ? dto.lastName : existingLast;
      updateData.staffName = `${firstName} ${lastName}`.trim();
    }

    if (dto.nicNumber !== undefined) updateData.nic = dto.nicNumber;
    if (dto.gender !== undefined) updateData.gender = dto.gender as Gender;
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.roleType !== undefined) updateData.roleType = dto.roleType;
    if (dto.salary !== undefined) updateData.salary = dto.salary ? new Prisma.Decimal(dto.salary) : null;
    if (dto.phoneNumber !== undefined) updateData.phone = dto.phoneNumber;
    if (dto.position !== undefined) updateData.position = dto.position;
    if (dto.department !== undefined) updateData.department = dto.department;
    if (dto.hireDate !== undefined) updateData.hirDate = dto.hireDate ? new Date(dto.hireDate) : null;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const updated = await prisma.supportStaff.update({
      where: { id },
      data: updateData,
    });

    return updated;
  }

  static async deleteSupportStaff(id: string) {
    const staff = await prisma.supportStaff.findUnique({
      where: { id },
    });

    if (!staff) {
      throw new AppError('Support staff member not found.', 404);
    }

    const deleted = await prisma.supportStaff.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    return deleted;
  }
}

export default SupportStaffService;
