import { Role, Prisma, AuditAction } from '@prisma/client';
import prisma from '../../../config/prisma.config';
import { hashPassword, generateTemporaryPassword, comparePasswords } from '../../../utils/password.util';
import { AppError } from '../../../utils/AppError';
import type { UpdateUserDto } from '../dto';

export interface UsersQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: 'all' | 'managers' | 'teachers' | 'students' | 'admins';
  status?: 'ACTIVE' | 'DISABLED';
  userRole?: Role; // The role of the requesting user
}

export interface PaginatedUsers {
  data: any[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

const userListSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  isActive: true,
  phone: true,
  profileImage: true,
  createdAt: true,
  updatedAt: true,
  student: {
    select: {
      indexNumber: true,
      phone: true,
      address: true,
      nic: true,
      gender: true,
      batch: true,
      isApproved: true,
    },
  },
  teacher: {
    select: {
      id: true,
      subjectId: true,
      salary: true,
      address: true,
      gender: true,
      nic: true,
      phone: true,
    },
  },
  manager: {
    select: {
      salary: true,
      address: true,
      gender: true,
      nic: true,
      joiningDate: true,
    },
  },
  admin: {
    select: {
      accessLevel: true,
    },
  },
} as const;

function formatUserListItem(user: any) {
  const response: any = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    phone: user.phone || null,
    profileImage: user.profileImage || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  if (user.student) {
    response.indexNumber = user.student.indexNumber;
    response.phone = user.student.phone || user.phone;
    response.address = user.student.address;
    response.nic = user.student.nic;
    response.gender = user.student.gender;
    response.batch = user.student.batch;
    response.isApproved = user.student.isApproved;
  }

  if (user.teacher) {
    response.teacherProfileId = user.teacher.id;
    response.subjectId = user.teacher.subjectId;
    response.subject = (user.teacher as any).__subjectName ?? null;
    response.salary = user.teacher.salary;
    response.address = user.teacher.address;
    response.nic = user.teacher.nic;
    response.gender = user.teacher.gender;
    response.phone = user.teacher.phone || user.phone;
  }

  if (user.manager) {
    response.salary = user.manager.salary;
    response.address = user.manager.address;
    response.nic = user.manager.nic;
    response.gender = user.manager.gender;
    response.joiningDate = user.manager.joiningDate;
  }

  if (user.admin) {
    response.accessLevel = user.admin.accessLevel;
  }

  return response;
}

/**
 * Users Service - Manages user account operations
 */
export class UsersService {
  /**
   * Get all users with role-based filtering and pagination
   */
  static async getUsers(params: UsersQueryParams): Promise<PaginatedUsers> {
    const page = params.page || 1;
    const limit = params.limit || 1000;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Filter by role if specified
    if (params.role && params.role !== 'all') {
      const roleMap: Record<string, Role> = {
        managers: Role.MANAGER,
        teachers: Role.TEACHER,
        students: Role.STUDENT,
        admins: Role.ADMIN,
      };
      where.role = roleMap[params.role];
    }

    // Filter by status
    if (params.status) {
      where.isActive = params.status === 'ACTIVE';
    }

    // Search by email or fullName
    if (params.search) {
      where.OR = [
        { email: { contains: params.search, mode: 'insensitive' } },
        { fullName: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: userListSelect,
      }),
      prisma.user.count({ where }),
    ]);

    const formattedUsers = users.map(formatUserListItem);

    // Resolve subject names for teachers in a single batch query
    const teacherSubjectIds = formattedUsers
      .filter((u) => u.subjectId)
      .map((u) => u.subjectId as string);

    if (teacherSubjectIds.length > 0) {
      const subjects = await prisma.subject.findMany({
        where: { id: { in: teacherSubjectIds } },
        select: { id: true, subjectName: true },
      });
      const subjectMap = new Map(subjects.map((s) => [s.id, s.subjectName]));
      formattedUsers.forEach((u) => {
        if (u.subjectId) {
          u.subject = subjectMap.get(u.subjectId) ?? null;
        }
      });
    }

    return {
      data: formattedUsers,
      total,
      page,
      limit,
      hasMore: skip + formattedUsers.length < total,
    };
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: userListSelect,
    });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    const formatted = formatUserListItem(user);

    // Resolve subject name for teacher
    if (formatted.subjectId) {
      const subject = await prisma.subject.findUnique({
        where: { id: formatted.subjectId },
        select: { subjectName: true },
      });
      formatted.subject = subject?.subjectName ?? null;
    }

    return formatted;
  }

  /**
   * Approve a student profile (set isApproved = true)
   */
  static async approveStudent(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { student: true } });
    if (!user) throw new AppError('User not found.', 404);
    if (user.role !== Role.STUDENT) throw new AppError('Target user is not a student.', 400);
    if (!user.student) throw new AppError('Student profile not found.', 404);

    if (user.student.isApproved) {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: userListSelect });
      if (!currentUser) throw new AppError('Error retrieving updated user.', 500);
      return formatUserListItem(currentUser);
    }

    await prisma.student.update({ where: { userId }, data: { isApproved: true } });

    await prisma.auditLog.create({
      data: {
        action: AuditAction.APPROVE,
        userId,
        module: 'STUDENT',
        description: `Student approved (userId=${userId})`,
      },
    });

    const updatedUser = await prisma.user.findUnique({ where: { id: userId }, select: userListSelect });
    if (!updatedUser) throw new AppError('Error retrieving updated user.', 500);
    return formatUserListItem(updatedUser);
  }

  /**
   * Get user by email
   */
  static async getUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });
  }

  /**
   * Create user account
   */
  static async createUser(dto: any, role: Role) {
    const existingUser = await prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });

    if (existingUser) {
      throw new AppError('Email already in use.', 409);
    }

    const providedPassword = typeof dto.password === 'string' && dto.password.trim().length > 0
      ? dto.password.trim()
      : generateTemporaryPassword(12);
    
    const hashedPassword = await hashPassword(providedPassword);
    
    const userData: any = {
      fullName: dto.fullName || `${dto.firstName || ''} ${dto.lastName || ''}`.trim(),
      email: dto.email.trim().toLowerCase(),
      password: hashedPassword,
      phone: dto.phone || dto.phoneNumber || null,
      role,
      isActive: true,
      forcePwdChange: true,
    };

    let user: any;
    try {
      await prisma.$transaction(async (tx) => {
        user = await tx.user.create({
          data: userData,
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        });

        switch (role) {
          case Role.MANAGER:
            await tx.manager.create({
              data: {
                userId: user.id,
                salary: dto.salary ? new Prisma.Decimal(dto.salary) : null,
                address: dto.address || null,
                gender: dto.gender || null,
                nic: dto.nic || dto.nicNumber || null,
                joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : null,
              },
            });
            break;

          case Role.TEACHER:
            await tx.teacher.create({
              data: {
                userId: user.id,
                subjectId: dto.subjectId || null,
                salary: dto.salary ? new Prisma.Decimal(dto.salary) : null,
                address: dto.address || null,
                gender: dto.gender || null,
                nic: dto.nic || dto.nicNumber || null,
                phone: dto.phone || dto.phoneNumber || null,
              },
            });
            break;

          case Role.STUDENT:
            await tx.student.create({
              data: {
                userId: user.id,
                indexNumber: dto.indexNumber || null,
                dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
                phone: dto.phone || dto.phoneNumber || null,
                address: dto.address || null,
                gender: dto.gender || null,
                batch: dto.batch || null,
                nic: dto.nic || dto.nicNumber || null,
                isApproved: dto.isApproved || false,
              },
            });
            break;

          case Role.ADMIN:
            await tx.admin.create({
              data: {
                userId: user.id,
                accessLevel: dto.accessLevel || 1,
              },
            });
            break;

          default:
            console.warn(`Unknown role: ${role}`);
        }
      });
    } catch (error) {
      console.error('Error during transactional user creation:', error);
      throw new AppError('Failed to create user account. Please try again.', 500);
    }

    await prisma.auditLog.create({
      data: {
        action: AuditAction.CREATE,
        userId: user.id,
        module: 'USER',
        description: `User ${user.email} created with role ${role}`,
      },
    });

    return { user, temporaryPassword: providedPassword };
  }

  /**
   * Change password for a user (self) — verifies current password
   */
  static async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new AppError('User not found.', 404);

    const match = await comparePasswords(oldPassword, user.password);
    if (!match) throw new AppError('Current password is incorrect.', 401);

    const hashed = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed, forcePwdChange: false },
    });

    await prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        userId,
        module: 'USER',
        description: 'User changed own password',
      },
    });

    return true;
  }

  /**
   * Admin resets a user's password; server generates temporary password and returns it
   */
  static async resetPassword(targetUserId: string) {
    const user = await prisma.user.findUnique({ where: { id: targetUserId } });

    if (!user) throw new AppError('User not found.', 404);

    const temporaryPassword = generateTemporaryPassword(12);
    const hashed = await hashPassword(temporaryPassword);

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { password: hashed, forcePwdChange: true },
      select: { id: true, email: true, role: true, isActive: true, createdAt: true },
    });

    await prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        userId: targetUserId,
        module: 'USER',
        description: 'Admin reset user password',
      },
    });

    return { user: updated, temporaryPassword };
  }

  /**
   * Admin sets a specific password for a user (used for fixing mismatches).
   * Returns the updated user and echoes back the submitted password so caller can display it.
   */
  static async setPasswordForUser(targetUserId: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new AppError('User not found.', 404);

    const normalized = newPassword.trim();
    const hashed = await hashPassword(normalized);

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { password: hashed, forcePwdChange: true },
      select: { id: true, email: true, role: true, isActive: true, createdAt: true },
    });

    await prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        userId: targetUserId,
        module: 'USER',
        description: 'Admin set user password',
      },
    });

    return { user: updated, temporaryPassword: newPassword };
  }

  /**
   * Update user details
   */
  static async updateUser(userId: string, dto: UpdateUserDto) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        manager: true,
        teacher: true,
        student: true,
        admin: true,
      },
    });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    if (dto.email && dto.email !== user.email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: dto.email.toLowerCase() },
      });

      if (existingEmail) {
        throw new AppError('Email already in use.', 409);
      }
    }

    const updateData: any = {};
    if (dto.email) updateData.email = dto.email.toLowerCase();
    if (dto.fullName) updateData.fullName = dto.fullName;
    else if (dto.firstName || dto.lastName) {
      const existingFirstName = dto.firstName || '';
      const existingLastName = dto.lastName || '';
      updateData.fullName = `${existingFirstName} ${existingLastName}`.trim();
    }
    if (dto.phoneNumber) updateData.phone = dto.phoneNumber;

    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: updateData,
      });
    }

    try {
      switch (user.role) {
        case Role.MANAGER: {
          const managerUpdateData: any = {};
          if (dto.nicNumber !== undefined) managerUpdateData.nic = dto.nicNumber;
          if (dto.gender !== undefined) managerUpdateData.gender = dto.gender;
          if (dto.address !== undefined) managerUpdateData.address = dto.address;
          if (dto.salary !== undefined) managerUpdateData.salary = dto.salary ? new Prisma.Decimal(dto.salary) : null;
          
          if (Object.keys(managerUpdateData).length > 0) {
            await prisma.manager.update({
              where: { userId },
              data: managerUpdateData,
            });
          }
          break;
        }

        case Role.TEACHER: {
          const teacherUpdateData: any = {};
          if (dto.subject !== undefined) teacherUpdateData.subjectId = dto.subject; // assume subjectId is passed in dto.subject
          if (dto.nicNumber !== undefined) teacherUpdateData.nic = dto.nicNumber;
          if (dto.gender !== undefined) teacherUpdateData.gender = dto.gender;
          if (dto.address !== undefined) teacherUpdateData.address = dto.address;
          if (dto.salary !== undefined) teacherUpdateData.salary = dto.salary ? new Prisma.Decimal(dto.salary) : null;
          if (dto.phoneNumber !== undefined) teacherUpdateData.phone = dto.phoneNumber;

          if (Object.keys(teacherUpdateData).length > 0) {
            await prisma.teacher.update({
              where: { userId },
              data: teacherUpdateData,
            });
          }
          break;
        }

        case Role.STUDENT: {
          const studentUpdateData: any = {};
          if (dto.indexNumber !== undefined) studentUpdateData.indexNumber = dto.indexNumber;
          if (dto.address !== undefined) studentUpdateData.address = dto.address;
          if (dto.phoneNumber !== undefined) studentUpdateData.phone = dto.phoneNumber;
          if (dto.gender !== undefined) studentUpdateData.gender = dto.gender;
          if (dto.nicNumber !== undefined) studentUpdateData.nic = dto.nicNumber;
          if (dto.roleType !== undefined) studentUpdateData.batch = dto.roleType; // map roleType to batch if it represents the class batch

          if (Object.keys(studentUpdateData).length > 0) {
            await prisma.student.update({
              where: { userId },
              data: studentUpdateData,
            });
          }
          break;
        }
      }
    } catch (error) {
      console.error('Error updating role-specific record:', error);
    }

    const updatedUserWithData = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        student: true,
        teacher: true,
        manager: true,
        admin: true,
      },
    });

    if (!updatedUserWithData) {
      throw new AppError('Error retrieving updated user.', 500);
    }

    await prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        userId,
        module: 'USER',
        description: `User ${user.email} updated`,
      },
    });

    return formatUserListItem(updatedUserWithData);
  }

  /**
   * Deactivate user account
   */
  static async deactivateUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    if (!user.isActive) {
      throw new AppError('User is already deactivated.', 400);
    }

    const deactivatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        userId,
        module: 'USER',
        description: `User ${user.email} deactivated`,
      },
    });

    return deactivatedUser;
  }

  /**
   * Activate user account
   */
  static async activateUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    if (user.isActive) {
      throw new AppError('User is already active.', 400);
    }

    const activatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        userId,
        module: 'USER',
        description: `User ${user.email} activated`,
      },
    });

    return activatedUser;
  }

  /**
   * Delete user (soft delete)
   */
  static async deleteUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    const deletedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive: false, deletedAt: new Date() },
      select: {
        id: true,
        email: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: AuditAction.DELETE,
        userId,
        module: 'USER',
        description: `User ${user.email} deleted (soft delete)`,
      },
    });

    return deletedUser;
  }
}

export default UsersService;
