import { Role, Prisma, AuditAction } from '@prisma/client';
import prisma from '../../../config/prisma.config';
import { notificationService } from '../../notification/service/notification.service';
import { hashPassword, generateTemporaryPassword, comparePasswords } from '../../../utils/password.util';
import { AppError } from '../../../utils/AppError';
import { sendEmail } from '../../../utils/email.util';
import type { UpdateUserDto } from '../dto';
import fs from 'fs/promises';
import path from 'path';
import { deleteCloudinaryImage } from '../../../utils/cloudinary.util';

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
      approvalStatus: true,
      dateOfBirth: true,
      school: true,
      parent: {
        select: {
          id: true,
          parentName: true,
          phone: true,
          occupation: true,
          email: true,
        }
      }
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
    response.student = {
      id: user.student.id,
      indexNumber: user.student.indexNumber,
      phone: user.student.phone || user.phone,
      address: user.student.address,
      nic: user.student.nic,
      gender: user.student.gender,
      batch: user.student.batch,
      approvalStatus: user.student.approvalStatus,
      dateOfBirth: user.student.dateOfBirth ? new Date(user.student.dateOfBirth).toISOString().split('T')[0] : null,
      school: user.student.school,
      parent: user.student.parent ? {
        id: user.student.parent.id,
        parentName: user.student.parent.parentName,
        phone: user.student.parent.phone,
        occupation: user.student.parent.occupation,
        email: user.student.parent.email,
      } : null,
    };
    response.indexNumber = user.student.indexNumber;
    response.phone = user.student.phone || user.phone;
    response.address = user.student.address;
    response.nic = user.student.nic;
    response.gender = user.student.gender;
    response.batch = user.student.batch;
    response.approvalStatus = user.student.approvalStatus;
    response.dateOfBirth = user.student.dateOfBirth ? new Date(user.student.dateOfBirth).toISOString().split('T')[0] : null;
    response.school = user.student.school;
    response.parent = user.student.parent ? {
      id: user.student.parent.id,
      parentName: user.student.parent.parentName,
      phone: user.student.parent.phone,
      occupation: user.student.parent.occupation,
      email: user.student.parent.email,
    } : null;
    response.parentEmail = user.student.parent ? user.student.parent.email : null;
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
   * Approve a student profile (set approvalStatus = APPROVED)
   */
  static async approveStudent(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { student: true } });
    if (!user) throw new AppError('User not found.', 404);
    if (user.role !== Role.STUDENT) throw new AppError('Target user is not a student.', 400);
    if (!user.student) throw new AppError('Student profile not found.', 404);

    if (user.student.approvalStatus === 'APPROVED') {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: userListSelect });
      if (!currentUser) throw new AppError('Error retrieving updated user.', 500);
      return formatUserListItem(currentUser);
    }

    await prisma.student.update({ where: { userId }, data: { approvalStatus: 'APPROVED' } });

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
    let studentResult: any;
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
            // 1. Create Parent if parentName is provided
            let parentId: string | undefined = undefined;
            if (dto.parentName) {
              const parent = await tx.parent.create({
                data: {
                  parentName: dto.parentName,
                  relation: dto.parentRelation,
                  email: dto.parentEmail || null,
                  phone: dto.parentPhone || null,
                },
              });
              parentId = parent.id;
            }

            // 2. Generate indexNumber
            const batchPrefix = `STD${dto.alExamBatch}`;
            const latestStudent = await tx.student.findFirst({
              where: { indexNumber: { startsWith: batchPrefix } },
              orderBy: { indexNumber: 'desc' },
            });
            
            let nextRunningNum = 1;
            if (latestStudent && latestStudent.indexNumber) {
              const lastNumStr = latestStudent.indexNumber.slice(-4);
              const lastNum = parseInt(lastNumStr, 10);
              if (!isNaN(lastNum)) {
                nextRunningNum = lastNum + 1;
              }
            }
            const newIndexNumber = `${batchPrefix}${nextRunningNum.toString().padStart(4, '0')}`;
            
            // 3. Generate QR code token
            const qrToken = `QR-${newIndexNumber}-${Math.random().toString(36).substring(2, 10)}`;

            // 4. Calculate fee amount
            const subjects = await tx.subject.findMany({
              where: { id: { in: dto.selectedCourseIds } },
              select: { feeAmount: true }
            });
            const totalFeeAmount = subjects.reduce((sum, s) => sum + Number(s.feeAmount), 0);

            // 5. Create student (manually created student accounts are APPROVED)
            const student = await tx.student.create({
              data: {
                userId: user.id,
                parentId,
                streamId: dto.selectedStreamId,
                indexNumber: newIndexNumber,
                nic: dto.nic || null,
                qrCode: qrToken,
                dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
                phone: dto.phone || dto.phoneNumber || null,
                address: dto.address || null,
                gender: dto.gender,
                school: dto.school || null,
                batch: dto.alExamBatch,
                batchId: dto.batchId || null,
                approvalStatus: 'APPROVED',
                paymentStatus: dto.paymentStatus || 'PENDING',
                totalFeeAmount: totalFeeAmount,
                feeEffectiveDate: new Date(),
                lastFeeUpdateDate: new Date(),
              },
            });
            studentResult = student;

            // 6. Create corresponding QRCode record
            await tx.qRCode.create({
              data: {
                studentId: student.id,
                qrToken: qrToken,
              }
            });

            // 7. Create enrollments
            if (dto.selectedCourseIds && Array.isArray(dto.selectedCourseIds)) {
              for (const subjectId of dto.selectedCourseIds) {
                const teacherId = dto.selectedTeacherIds?.[subjectId];
                await tx.enrollment.create({
                  data: {
                    studentId: student.id,
                    subjectId,
                    teacherId: teacherId || null,
                    enrollmentStatus: 'ACTIVE',
                  },
                });
              }
            }
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

    // Notify all active Admins about the new registration
    try {
      const admins = await prisma.user.findMany({
        where: {
          role: Role.ADMIN,
          isActive: true,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (admins.length > 0) {
        const adminIds = admins.map((a) => a.id);
        const roleLabel = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase().replace('_', ' ');
        await notificationService.createNotifications({
          senderId: user.id,
          receiverIds: adminIds,
          title: `New ${roleLabel} Registered`,
          message: `${userData.fullName} created an account.`,
          type: 'USER_REGISTRATION',
          referenceType: 'USER',
          referenceId: user.id,
        });
      }
    } catch (notificationError) {
      console.error('Failed to send registration notifications to admins:', notificationError);
    }

    // Post-creation email sending for STUDENT, TEACHER, MANAGER
    if (role === Role.STUDENT || role === Role.TEACHER || role === Role.MANAGER) {
      const roleLabel = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase().replace('_', ' ');
      const emailContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #059669;">Welcome to PyramidEdu!</h2>
          <p>Dear ${userData.fullName},</p>
          <p>Your ${roleLabel} account has been manually created by an administrator.</p>
          <p>Here are your temporary login credentials:</p>
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <p style="margin: 0 0 10px 0;"><strong>Email/Username:</strong> ${userData.email}</p>
            <p style="margin: 0;"><strong>Temporary Password:</strong> <code style="font-size: 1.1em; color: #dc2626; background: #fee2e2; padding: 2px 6px; border-radius: 4px;">${providedPassword}</code></p>
          </div>
          <p style="color: #475569; font-size: 0.9em; margin-bottom: 20px;">
            <strong>Important:</strong> You are required to change your password immediately upon your first login.
          </p>
        </div>
      `;
      try {
        await sendEmail(
          userData.email,
          'PyramidEdu - Account Created & Temporary Password',
          emailContent
        );
      } catch (err) {
        console.error(`Failed to send email to ${roleLabel}:`, err);
      }
    }

    return { user, student: studentResult, temporaryPassword: providedPassword };
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
    if (dto.profileImage !== undefined) updateData.profileImage = dto.profileImage;

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
          if (dto.roleType !== undefined) studentUpdateData.batch = dto.roleType;
          if (dto.school !== undefined) studentUpdateData.school = dto.school;
          if (dto.dateOfBirth !== undefined) {
            studentUpdateData.dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
          }

          // Parent info update
          if (dto.parentName !== undefined || dto.parentPhone !== undefined || dto.parentOccupation !== undefined || dto.parentEmail !== undefined) {
            const parentUpdateData: any = {};
            if (dto.parentName !== undefined) parentUpdateData.parentName = dto.parentName;
            if (dto.parentPhone !== undefined) parentUpdateData.phone = dto.parentPhone;
            if (dto.parentOccupation !== undefined) parentUpdateData.occupation = dto.parentOccupation;
            if (dto.parentEmail !== undefined) parentUpdateData.email = dto.parentEmail;

            if (user.student?.parentId) {
              await prisma.parent.update({
                where: { id: user.student.parentId },
                data: parentUpdateData,
              });
            } else {
              const newParent = await prisma.parent.create({
                data: {
                  parentName: dto.parentName || 'Parent',
                  phone: dto.parentPhone || '',
                  occupation: dto.parentOccupation || '',
                  email: dto.parentEmail || '',
                }
              });
              studentUpdateData.parentId = newParent.id;
            }
          }

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
        student: {
          include: {
            parent: true,
            stream: true,
          },
        },
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

    // Send profile update notification
    try {
      await notificationService.createNotification({
        senderId: null,
        receiverId: userId,
        title: 'Profile Updated',
        message: 'Your account profile information has been successfully updated.',
        type: 'SYSTEM',
        referenceType: 'PROFILE',
        referenceId: userId,
      });
    } catch (err) {
      console.error('Failed to trigger profile update notification:', err);
    }

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

  /**
   * Update profile image
   */
  static async updateProfileImage(userId: string, imageUrl: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { profileImage: true, email: true },
    });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    // If there is an old profile image, try to delete it to save space
    if (user.profileImage) {
      if (user.profileImage.startsWith('/uploads/profile/')) {
        try {
          const oldImagePath = path.join(__dirname, '../../../../', user.profileImage);
          await fs.unlink(oldImagePath);
        } catch (err) {
          console.error(`Failed to delete old local profile image: ${user.profileImage}`, err);
          // Continue even if delete fails
        }
      } else if (user.profileImage.includes('res.cloudinary.com')) {
        try {
          const parts = user.profileImage.split('/upload/');
          if (parts.length > 1) {
            const pathAfterUpload = parts[1];
            const pathParts = pathAfterUpload.split('/');
            if (pathParts[0].startsWith('v') && /^\d+$/.test(pathParts[0].slice(1))) {
              pathParts.shift();
            }
            const fullPathWithExt = pathParts.join('/');
            const dotIdx = fullPathWithExt.lastIndexOf('.');
            const publicId = dotIdx !== -1 ? fullPathWithExt.substring(0, dotIdx) : fullPathWithExt;
            
            await deleteCloudinaryImage(publicId);
          }
        } catch (err) {
          console.error(`Failed to delete old Cloudinary image: ${user.profileImage}`, err);
        }
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { profileImage: imageUrl },
    });

    await prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        userId,
        module: 'USER',
        description: `User ${user.email} updated profile image`,
      },
    });

    return formatUserListItem(updatedUser);
  }

  /**
   * Get admin dashboard stats (counts and recent registrations)
   */
  static async getAdminDashboardStats() {
    const [
      totalStudents,
      totalTeachers,
      totalManagers,
      totalAdmins,
      totalSubjects,
      totalBatches,
      recentAdmins,
    ] = await Promise.all([
      prisma.student.count({ where: { deletedAt: null } }),
      prisma.teacher.count({ where: { deletedAt: null } }),
      prisma.manager.count({ where: { deletedAt: null } }),
      prisma.admin.count(),
      prisma.subject.count({ where: { isActive: true } }),
      prisma.batch.count({ where: { isActive: true } }),
      prisma.user.findMany({
        where: {
          role: Role.ADMIN,
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
        select: {
          id: true,
          fullName: true,
          email: true,
          isActive: true,
          createdAt: true,
        },
      }),
    ]);

    const memoryUsage = process.memoryUsage();
    const totalMem = 8 * 1024 * 1024 * 1024; // estimate 8GB total
    const memoryPercent = Math.min(95, Math.max(5, Math.round((memoryUsage.heapUsed / totalMem) * 100)));

    return {
      totalStudents,
      totalTeachers,
      totalManagers,
      totalAdmins,
      totalSubjects,
      totalBatches,
      recentAdmins,
      systemStats: {
        cpuUsage: "15%",
        memoryUsage: `${memoryPercent}%`,
        uptime: `${Math.round(process.uptime() / 3600)}h`,
      }
    };
  }
}

export default UsersService;
