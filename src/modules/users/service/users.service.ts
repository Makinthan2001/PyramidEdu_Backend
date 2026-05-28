import { UserRole, Prisma } from '@prisma/client';
import prisma from '../../../config/prisma.config';
import { hashPassword, generateTemporaryPassword, comparePasswords } from '../../../utils/password.util';
import { AppError } from '../../../utils/AppError';
import type { CreateUserDto, UpdateUserDto } from '../dto';

export interface UsersQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: 'all' | 'managers' | 'teachers' | 'students' | 'supportStaff' | 'admins';
  status?: 'ACTIVE' | 'DISABLED';
  userRole?: UserRole; // The role of the requesting user
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
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  student: {
    select: {
      firstName: true,
      lastName: true,
      indexNumber: true,
      phone: true,
      address: true,
    },
  },
  teacher: {
    select: {
      firstName: true,
      lastName: true,
      specialization: true,
      salary: true,
    },
  },
  manager: {
    select: {
      fullName: true,
    },
  },
  supportStaff: {
    select: {
      fullName: true,
      roleType: true,
      salary: true,
    },
  },
} as const;

function formatUserListItem(user: any) {
  const response: any = {
    id: user.id,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  if (user.student) {
    response.firstName = user.student.firstName;
    response.lastName = user.student.lastName;
    response.indexNumber = user.student.indexNumber;
    response.phone = user.student.phone;
    response.address = user.student.address;
  }

  if (user.teacher) {
    response.firstName = user.teacher.firstName;
    response.lastName = user.teacher.lastName;
    response.subject = user.teacher.specialization;
    response.specialization = user.teacher.specialization;
    response.salary = user.teacher.salary;
  }

  if (user.manager) {
    response.fullName = user.manager.fullName;
  }

  if (user.supportStaff) {
    response.fullName = user.supportStaff.fullName;
    response.roleType = user.supportStaff.roleType;
    response.salary = user.supportStaff.salary;
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
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Role-based access control
    if (params.userRole === UserRole.MANAGER) {
      // MANAGER can only see STUDENT users
      where.role = UserRole.STUDENT;
    } else if (params.userRole !== UserRole.ADMIN) {
      // Non-admin, non-manager users cannot list users
      throw new AppError(
        'You do not have permission to list users.',
        403
      );
    }

    // Filter by role if specified
    if (params.role && params.role !== 'all') {
      const roleMap: Record<string, UserRole> = {
        managers: UserRole.MANAGER,
        teachers: UserRole.TEACHER,
        students: UserRole.STUDENT,
        supportStaff: UserRole.SUPPORT_STAFF,
        admins: UserRole.ADMIN,
      };
      where.role = roleMap[params.role];
    }

    // Filter by status
    if (params.status) {
      where.isActive = params.status === 'ACTIVE';
    }

    // Search by email (only field in User table)
    if (params.search) {
      where.email = { contains: params.search, mode: 'insensitive' };
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
  static async getUserById(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: userListSelect,
    });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    return formatUserListItem(user);
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
  static async createUser(dto: any, role: UserRole) {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new AppError('Email already in use.', 409);
    }

    // Generate a cryptographically secure temporary password (backend only)
    const temporaryPassword = generateTemporaryPassword(12);

    // Hash temporary password before saving
    const hashedPassword = await hashPassword(temporaryPassword);

    // Prepare user data - only use fields that exist in User table
    const userData: any = {
      email: dto.email.toLowerCase(),
      passwordHash: hashedPassword,
      role,
      isActive: true,
      forcePasswordChange: true,
    };

    const user = await prisma.user.create({
      data: userData,
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Create role-specific record
    try {
      switch (role) {
        case UserRole.MANAGER:
          await prisma.manager.create({
            data: {
              userId: user.id,
              firstName: dto.firstName,
              lastName: dto.lastName,
              nicNumber: dto.nicNumber,
              gender: dto.gender,
              address: dto.address,
              phone: dto.phoneNumber,
              salary: dto.salary ? new Prisma.Decimal(dto.salary) : null,
              fullName: `${dto.firstName} ${dto.lastName}`.trim(),
            } as any,
          });
          break;

        case UserRole.TEACHER:
          await prisma.teacher.create({
            data: {
              userId: user.id,
              firstName: dto.firstName,
              lastName: dto.lastName,
              nicNumber: dto.nicNumber,
              gender: dto.gender,
              address: dto.address,
              phone: dto.phoneNumber,
              specialization: dto.subject,
              salary: dto.salary ? new Prisma.Decimal(dto.salary) : null,
            },
          });
          break;

        case UserRole.STUDENT:
          await prisma.student.create({
            data: {
              userId: user.id,
              firstName: dto.firstName,
              lastName: dto.lastName,
              indexNumber: dto.indexNumber,
              phone: dto.phoneNumber,
              address: dto.address,
              // parentId will need to be set separately if parent exists
            },
          });
          break;

        case UserRole.SUPPORT_STAFF:
          await prisma.supportStaff.create({
            data: {
              userId: user.id,
              fullName: dto.fullName,
              roleType: dto.roleType,
              salary: dto.salary ? new Prisma.Decimal(dto.salary) : null,
            },
          });
          break;

        case UserRole.ADMIN:
          // ADMIN role doesn't have a separate table
          break;

        default:
          console.warn(`Unknown role: ${role}`);
      }
    } catch (error) {
      console.error('Error creating role-specific record:', error);
      // Continue - user is created even if role-specific record fails
    }

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        action: 'USER_CREATED',
        userId: user.id,
        resourceType: 'USER',
        resourceId: user.id,
        details: `User ${user.email} created with role ${role}`,
      },
    });

    // Return user and temporary password (temporaryPassword must be communicated securely by the admin)
    return { user, temporaryPassword };
  }

  /**
   * Change password for a user (self) — verifies current password
   */
  static async changePassword(userId: number, oldPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new AppError('User not found.', 404);

    // Verify old password
    const match = await comparePasswords(oldPassword, user.passwordHash);
    if (!match) throw new AppError('Current password is incorrect.', 401);

    // Hash new password and update
    const hashed = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashed, forcePasswordChange: false },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        action: 'PASSWORD_CHANGED',
        userId,
        resourceType: 'USER',
        resourceId: userId,
        details: 'User changed own password',
      },
    });

    return true;
  }

  /**
   * Admin resets a user's password; server generates temporary password and returns it
   */
  static async resetPassword(targetUserId: number) {
    const user = await prisma.user.findUnique({ where: { id: targetUserId } });

    if (!user) throw new AppError('User not found.', 404);

    const temporaryPassword = generateTemporaryPassword(12);
    const hashed = await hashPassword(temporaryPassword);

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { passwordHash: hashed, forcePasswordChange: true },
      select: { id: true, email: true, role: true, isActive: true, createdAt: true },
    });

    await prisma.auditLog.create({
      data: {
        action: 'PASSWORD_RESET',
        userId: targetUserId,
        resourceType: 'USER',
        resourceId: targetUserId,
        details: 'Admin reset user password',
      },
    });

    return { user: updated, temporaryPassword };
  }

  /**
   * Update user details
   */
  static async updateUser(userId: number, dto: UpdateUserDto) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        manager: true,
        teacher: true,
        student: true,
        supportStaff: true,
      },
    });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    // Check if new email is already in use by another user
    if (dto.email && dto.email !== user.email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: dto.email.toLowerCase() },
      });

      if (existingEmail) {
        throw new AppError('Email already in use.', 409);
      }
    }

    const updateData: any = {};

    // Only update fields that exist in User table
    if (dto.email) updateData.email = dto.email.toLowerCase();
    if (dto.phoneNumber) updateData.phoneNumber = dto.phoneNumber;

    // Update User table if there are changes
    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: updateData,
      });
    }

    // Update role-specific table based on user's role
    try {
      switch (user.role) {
        case UserRole.MANAGER:
          if (dto.firstName || dto.lastName || dto.nicNumber || dto.gender || dto.address || dto.phoneNumber || dto.salary) {
            const managerUpdateData: any = {};
            if (dto.firstName) managerUpdateData.firstName = dto.firstName;
            if (dto.lastName) managerUpdateData.lastName = dto.lastName;
            if (dto.nicNumber) managerUpdateData.nicNumber = dto.nicNumber;
            if (dto.gender) managerUpdateData.gender = dto.gender;
            if (dto.address) managerUpdateData.address = dto.address;
            if (dto.phoneNumber) managerUpdateData.phone = dto.phoneNumber;
            if (dto.salary !== undefined) managerUpdateData.salary = dto.salary ? new Prisma.Decimal(dto.salary) : null;
            if (dto.firstName || dto.lastName) {
              const managerRecord = user.manager as any;
              const existingFirstName = dto.firstName || managerRecord?.firstName || '';
              const existingLastName = dto.lastName || managerRecord?.lastName || '';
              managerUpdateData.fullName = `${existingFirstName} ${existingLastName}`.trim();
            }
            await prisma.manager.update({
              where: { userId },
              data: managerUpdateData,
            });
          }
          break;

        case UserRole.TEACHER:
          if (dto.firstName || dto.lastName || dto.subject) {
            const teacherUpdateData: any = {};
            if (dto.firstName) teacherUpdateData.firstName = dto.firstName;
            if (dto.lastName) teacherUpdateData.lastName = dto.lastName;
            if (dto.subject) teacherUpdateData.specialization = dto.subject;
            await prisma.teacher.update({
              where: { userId },
              data: teacherUpdateData,
            });
          }
          break;

        case UserRole.STUDENT:
          if (dto.firstName || dto.lastName || dto.indexNumber || dto.address || dto.parentName || dto.parentPhone) {
            const studentUpdateData: any = {};
            if (dto.firstName) studentUpdateData.firstName = dto.firstName;
            if (dto.lastName) studentUpdateData.lastName = dto.lastName;
            if (dto.indexNumber) studentUpdateData.indexNumber = dto.indexNumber;
            if (dto.address) studentUpdateData.address = dto.address;
            if (dto.parentName) studentUpdateData.parentName = dto.parentName;
            if (dto.parentPhone) studentUpdateData.phone = dto.parentPhone;
            await prisma.student.update({
              where: { userId },
              data: studentUpdateData,
            });
          }
          break;

        case UserRole.SUPPORT_STAFF:
          if (dto.fullName || dto.subject) {
            // Note: roleType is stored in subject field for support staff updates
            const supportUpdateData: any = {};
            if (dto.fullName) supportUpdateData.fullName = dto.fullName;
            if (dto.subject) supportUpdateData.roleType = dto.subject;
            await prisma.supportStaff.update({
              where: { userId },
              data: supportUpdateData,
            });
          }
          break;
      }
    } catch (error) {
      console.error('Error updating role-specific record:', error);
      // Continue - return user data even if role update fails
    }

    // Fetch updated user with role-specific data
    const updatedUserWithData = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        student: true,
        teacher: true,
        manager: true,
        supportStaff: true,
      },
    });

    if (!updatedUserWithData) {
      throw new AppError('Error retrieving updated user.', 500);
    }

    // Merge response with role-specific data
    const response: any = {
      id: updatedUserWithData.id,
      email: updatedUserWithData.email,
      role: updatedUserWithData.role,
      isActive: updatedUserWithData.isActive,
      updatedAt: updatedUserWithData.updatedAt,
    };

    if (updatedUserWithData.student) {
      response.firstName = updatedUserWithData.student.firstName;
      response.lastName = updatedUserWithData.student.lastName;
      response.indexNumber = updatedUserWithData.student.indexNumber;
      response.phone = updatedUserWithData.student.phone;
      response.address = updatedUserWithData.student.address;
    }

    if (updatedUserWithData.teacher) {
      response.firstName = updatedUserWithData.teacher.firstName;
      response.lastName = updatedUserWithData.teacher.lastName;
      response.specialization = updatedUserWithData.teacher.specialization;
    }

    if (updatedUserWithData.manager) {
      const manager = updatedUserWithData.manager as any;
      response.firstName = manager.firstName;
      response.lastName = manager.lastName;
      response.nicNumber = manager.nicNumber;
      response.gender = manager.gender;
      response.address = manager.address;
      response.phone = manager.phone;
      response.salary = manager.salary;
      response.fullName = manager.fullName;
    }

    if (updatedUserWithData.supportStaff) {
      response.fullName = updatedUserWithData.supportStaff.fullName;
      response.roleType = updatedUserWithData.supportStaff.roleType;
    }

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        action: 'USER_UPDATED',
        userId,
        resourceType: 'USER',
        resourceId: userId,
        details: `User ${user.email} updated`,
      },
    });

    return response;
  }

  /**
   * Deactivate user account
   */
  static async deactivateUser(userId: number) {
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

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        action: 'USER_DEACTIVATED',
        userId,
        resourceType: 'USER',
        resourceId: userId,
        details: `User ${user.email} deactivated`,
      },
    });

    return deactivatedUser;
  }

  /**
   * Activate user account
   */
  static async activateUser(userId: number) {
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

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        action: 'USER_ACTIVATED',
        userId,
        resourceType: 'USER',
        resourceId: userId,
        details: `User ${user.email} activated`,
      },
    });

    return activatedUser;
  }

  /**
   * Delete user (soft delete)
   */
  static async deleteUser(userId: number) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    // Soft delete - set isActive to false
    const deletedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
      },
    });

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        action: 'USER_DELETED',
        userId,
        resourceType: 'USER',
        resourceId: userId,
        details: `User ${user.email} deleted (soft delete)`,
      },
    });

    return deletedUser;
  }
}

export default UsersService;
