"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const client_1 = require("@prisma/client");
const prisma_config_1 = __importDefault(require("../../../config/prisma.config"));
const password_util_1 = require("../../../utils/password.util");
const AppError_1 = require("../../../utils/AppError");
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
            firstName: true,
            lastName: true,
            nicNumber: true,
            gender: true,
            address: true,
            phone: true,
            fullName: true,
            roleType: true,
            salary: true,
        },
    },
};
function formatUserListItem(user) {
    const response = {
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
        response.firstName = user.supportStaff.firstName;
        response.lastName = user.supportStaff.lastName;
        response.nicNumber = user.supportStaff.nicNumber;
        response.gender = user.supportStaff.gender;
        response.address = user.supportStaff.address;
        response.phone = user.supportStaff.phone;
        response.fullName = user.supportStaff.fullName;
        response.roleType = user.supportStaff.roleType;
        response.salary = user.supportStaff.salary;
    }
    return response;
}
/**
 * Users Service - Manages user account operations
 */
class UsersService {
    /**
     * Get all users with role-based filtering and pagination
     */
    static getUsers(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const page = params.page || 1;
            const limit = params.limit || 10;
            const skip = (page - 1) * limit;
            const where = {};
            // Role-based access control
            if (params.userRole === client_1.UserRole.MANAGER) {
                // MANAGER can only see STUDENT users
                where.role = client_1.UserRole.STUDENT;
            }
            else if (params.userRole !== client_1.UserRole.ADMIN) {
                // Non-admin, non-manager users cannot list users
                throw new AppError_1.AppError('You do not have permission to list users.', 403);
            }
            // Filter by role if specified
            if (params.role && params.role !== 'all') {
                const roleMap = {
                    managers: client_1.UserRole.MANAGER,
                    teachers: client_1.UserRole.TEACHER,
                    students: client_1.UserRole.STUDENT,
                    supportStaff: client_1.UserRole.SUPPORT_STAFF,
                    admins: client_1.UserRole.ADMIN,
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
            const [users, total] = yield Promise.all([
                prisma_config_1.default.user.findMany({
                    where,
                    skip,
                    take: limit,
                    select: userListSelect,
                }),
                prisma_config_1.default.user.count({ where }),
            ]);
            const formattedUsers = users.map(formatUserListItem);
            return {
                data: formattedUsers,
                total,
                page,
                limit,
                hasMore: skip + formattedUsers.length < total,
            };
        });
    }
    /**
     * Get user by ID
     */
    static getUserById(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_config_1.default.user.findUnique({
                where: { id: userId },
                select: userListSelect,
            });
            if (!user) {
                throw new AppError_1.AppError('User not found.', 404);
            }
            return formatUserListItem(user);
        });
    }
    /**
     * Get user by email
     */
    static getUserByEmail(email) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_config_1.default.user.findUnique({
                where: { email: email.toLowerCase() },
                select: {
                    id: true,
                    email: true,
                    role: true,
                    isActive: true,
                },
            });
        });
    }
    /**
     * Create user account
     */
    static createUser(dto, role) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if email already exists
            const existingUser = yield prisma_config_1.default.user.findUnique({
                where: { email: dto.email.toLowerCase() },
            });
            if (existingUser) {
                throw new AppError_1.AppError('Email already in use.', 409);
            }
            // Generate a cryptographically secure temporary password (backend only)
            const temporaryPassword = role === client_1.UserRole.SUPPORT_STAFF ? undefined : (0, password_util_1.generateTemporaryPassword)(12);
            // Hash temporary password before saving
            const hashedPassword = yield (0, password_util_1.hashPassword)(temporaryPassword !== null && temporaryPassword !== void 0 ? temporaryPassword : (0, password_util_1.generateTemporaryPassword)(12));
            // Prepare user data - only use fields that exist in User table
            const userData = {
                email: dto.email.toLowerCase(),
                passwordHash: hashedPassword,
                role,
                isActive: true,
                forcePasswordChange: true,
            };
            const user = yield prisma_config_1.default.user.create({
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
                    case client_1.UserRole.MANAGER:
                        yield prisma_config_1.default.manager.create({
                            data: {
                                userId: user.id,
                                firstName: dto.firstName,
                                lastName: dto.lastName,
                                nicNumber: dto.nicNumber,
                                gender: dto.gender,
                                address: dto.address,
                                phone: dto.phoneNumber,
                                salary: dto.salary ? new client_1.Prisma.Decimal(dto.salary) : null,
                                fullName: `${dto.firstName} ${dto.lastName}`.trim(),
                            },
                        });
                        break;
                    case client_1.UserRole.TEACHER:
                        yield prisma_config_1.default.teacher.create({
                            data: {
                                userId: user.id,
                                firstName: dto.firstName,
                                lastName: dto.lastName,
                                nicNumber: dto.nicNumber,
                                gender: dto.gender,
                                address: dto.address,
                                phone: dto.phoneNumber,
                                specialization: dto.subject,
                                salary: dto.salary ? new client_1.Prisma.Decimal(dto.salary) : null,
                            },
                        });
                        break;
                    case client_1.UserRole.STUDENT:
                        yield prisma_config_1.default.student.create({
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
                    case client_1.UserRole.SUPPORT_STAFF:
                        yield prisma_config_1.default.supportStaff.create({
                            data: {
                                userId: user.id,
                                firstName: dto.firstName,
                                lastName: dto.lastName,
                                nicNumber: dto.nicNumber,
                                gender: dto.gender,
                                address: dto.address,
                                phone: dto.phoneNumber,
                                fullName: `${dto.firstName} ${dto.lastName}`.trim(),
                                roleType: dto.roleType,
                                salary: dto.salary ? new client_1.Prisma.Decimal(dto.salary) : null,
                            },
                        });
                        break;
                    case client_1.UserRole.ADMIN:
                        // ADMIN role doesn't have a separate table
                        break;
                    default:
                        console.warn(`Unknown role: ${role}`);
                }
            }
            catch (error) {
                console.error('Error creating role-specific record:', error);
                // Continue - user is created even if role-specific record fails
            }
            // Log audit entry
            yield prisma_config_1.default.auditLog.create({
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
        });
    }
    /**
     * Change password for a user (self) — verifies current password
     */
    static changePassword(userId, oldPassword, newPassword) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_config_1.default.user.findUnique({ where: { id: userId } });
            if (!user)
                throw new AppError_1.AppError('User not found.', 404);
            // Verify old password
            const match = yield (0, password_util_1.comparePasswords)(oldPassword, user.passwordHash);
            if (!match)
                throw new AppError_1.AppError('Current password is incorrect.', 401);
            // Hash new password and update
            const hashed = yield (0, password_util_1.hashPassword)(newPassword);
            yield prisma_config_1.default.user.update({
                where: { id: userId },
                data: { passwordHash: hashed, forcePasswordChange: false },
            });
            // Log audit
            yield prisma_config_1.default.auditLog.create({
                data: {
                    action: 'PASSWORD_CHANGED',
                    userId,
                    resourceType: 'USER',
                    resourceId: userId,
                    details: 'User changed own password',
                },
            });
            return true;
        });
    }
    /**
     * Admin resets a user's password; server generates temporary password and returns it
     */
    static resetPassword(targetUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_config_1.default.user.findUnique({ where: { id: targetUserId } });
            if (!user)
                throw new AppError_1.AppError('User not found.', 404);
            const temporaryPassword = (0, password_util_1.generateTemporaryPassword)(12);
            const hashed = yield (0, password_util_1.hashPassword)(temporaryPassword);
            const updated = yield prisma_config_1.default.user.update({
                where: { id: targetUserId },
                data: { passwordHash: hashed, forcePasswordChange: true },
                select: { id: true, email: true, role: true, isActive: true, createdAt: true },
            });
            yield prisma_config_1.default.auditLog.create({
                data: {
                    action: 'PASSWORD_RESET',
                    userId: targetUserId,
                    resourceType: 'USER',
                    resourceId: targetUserId,
                    details: 'Admin reset user password',
                },
            });
            return { user: updated, temporaryPassword };
        });
    }
    /**
     * Update user details
     */
    static updateUser(userId, dto) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_config_1.default.user.findUnique({
                where: { id: userId },
                include: {
                    manager: true,
                    teacher: true,
                    student: true,
                    supportStaff: true,
                },
            });
            if (!user) {
                throw new AppError_1.AppError('User not found.', 404);
            }
            // Check if new email is already in use by another user
            if (dto.email && dto.email !== user.email) {
                const existingEmail = yield prisma_config_1.default.user.findUnique({
                    where: { email: dto.email.toLowerCase() },
                });
                if (existingEmail) {
                    throw new AppError_1.AppError('Email already in use.', 409);
                }
            }
            const updateData = {};
            // Only update fields that exist in User table
            if (dto.email)
                updateData.email = dto.email.toLowerCase();
            if (dto.phoneNumber)
                updateData.phoneNumber = dto.phoneNumber;
            // Update User table if there are changes
            if (Object.keys(updateData).length > 0) {
                yield prisma_config_1.default.user.update({
                    where: { id: userId },
                    data: updateData,
                });
            }
            // Update role-specific table based on user's role
            try {
                switch (user.role) {
                    case client_1.UserRole.MANAGER:
                        if (dto.firstName || dto.lastName || dto.nicNumber || dto.gender || dto.address || dto.phoneNumber || dto.salary) {
                            const managerUpdateData = {};
                            if (dto.firstName)
                                managerUpdateData.firstName = dto.firstName;
                            if (dto.lastName)
                                managerUpdateData.lastName = dto.lastName;
                            if (dto.nicNumber)
                                managerUpdateData.nicNumber = dto.nicNumber;
                            if (dto.gender)
                                managerUpdateData.gender = dto.gender;
                            if (dto.address)
                                managerUpdateData.address = dto.address;
                            if (dto.phoneNumber)
                                managerUpdateData.phone = dto.phoneNumber;
                            if (dto.salary !== undefined)
                                managerUpdateData.salary = dto.salary ? new client_1.Prisma.Decimal(dto.salary) : null;
                            if (dto.firstName || dto.lastName) {
                                const managerRecord = user.manager;
                                const existingFirstName = dto.firstName || (managerRecord === null || managerRecord === void 0 ? void 0 : managerRecord.firstName) || '';
                                const existingLastName = dto.lastName || (managerRecord === null || managerRecord === void 0 ? void 0 : managerRecord.lastName) || '';
                                managerUpdateData.fullName = `${existingFirstName} ${existingLastName}`.trim();
                            }
                            yield prisma_config_1.default.manager.update({
                                where: { userId },
                                data: managerUpdateData,
                            });
                        }
                        break;
                    case client_1.UserRole.TEACHER:
                        if (dto.firstName || dto.lastName || dto.subject) {
                            const teacherUpdateData = {};
                            if (dto.firstName)
                                teacherUpdateData.firstName = dto.firstName;
                            if (dto.lastName)
                                teacherUpdateData.lastName = dto.lastName;
                            if (dto.subject)
                                teacherUpdateData.specialization = dto.subject;
                            yield prisma_config_1.default.teacher.update({
                                where: { userId },
                                data: teacherUpdateData,
                            });
                        }
                        break;
                    case client_1.UserRole.STUDENT:
                        if (dto.firstName || dto.lastName || dto.indexNumber || dto.address || dto.parentName || dto.parentPhone) {
                            const studentUpdateData = {};
                            if (dto.firstName)
                                studentUpdateData.firstName = dto.firstName;
                            if (dto.lastName)
                                studentUpdateData.lastName = dto.lastName;
                            if (dto.indexNumber)
                                studentUpdateData.indexNumber = dto.indexNumber;
                            if (dto.address)
                                studentUpdateData.address = dto.address;
                            if (dto.parentName)
                                studentUpdateData.parentName = dto.parentName;
                            if (dto.parentPhone)
                                studentUpdateData.phone = dto.parentPhone;
                            yield prisma_config_1.default.student.update({
                                where: { userId },
                                data: studentUpdateData,
                            });
                        }
                        break;
                    case client_1.UserRole.SUPPORT_STAFF:
                        if (dto.firstName || dto.lastName || dto.nicNumber || dto.gender || dto.address || dto.phoneNumber || dto.roleType || dto.salary) {
                            const supportUpdateData = {};
                            if (dto.firstName)
                                supportUpdateData.firstName = dto.firstName;
                            if (dto.lastName)
                                supportUpdateData.lastName = dto.lastName;
                            if (dto.nicNumber)
                                supportUpdateData.nicNumber = dto.nicNumber;
                            if (dto.gender)
                                supportUpdateData.gender = dto.gender;
                            if (dto.address)
                                supportUpdateData.address = dto.address;
                            if (dto.phoneNumber)
                                supportUpdateData.phone = dto.phoneNumber;
                            if (dto.roleType)
                                supportUpdateData.roleType = dto.roleType;
                            if (dto.firstName || dto.lastName) {
                                const supportRecord = user.supportStaff;
                                const existingFirstName = dto.firstName || (supportRecord === null || supportRecord === void 0 ? void 0 : supportRecord.firstName) || '';
                                const existingLastName = dto.lastName || (supportRecord === null || supportRecord === void 0 ? void 0 : supportRecord.lastName) || '';
                                supportUpdateData.fullName = `${existingFirstName} ${existingLastName}`.trim();
                            }
                            if (dto.salary !== undefined)
                                supportUpdateData.salary = dto.salary ? new client_1.Prisma.Decimal(dto.salary) : null;
                            yield prisma_config_1.default.supportStaff.update({
                                where: { userId },
                                data: supportUpdateData,
                            });
                        }
                        break;
                }
            }
            catch (error) {
                console.error('Error updating role-specific record:', error);
                // Continue - return user data even if role update fails
            }
            // Fetch updated user with role-specific data
            const updatedUserWithData = yield prisma_config_1.default.user.findUnique({
                where: { id: userId },
                include: {
                    student: true,
                    teacher: true,
                    manager: true,
                    supportStaff: true,
                },
            });
            if (!updatedUserWithData) {
                throw new AppError_1.AppError('Error retrieving updated user.', 500);
            }
            // Merge response with role-specific data
            const response = {
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
                const manager = updatedUserWithData.manager;
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
                const supportStaff = updatedUserWithData.supportStaff;
                response.firstName = supportStaff.firstName;
                response.lastName = supportStaff.lastName;
                response.nicNumber = supportStaff.nicNumber;
                response.gender = supportStaff.gender;
                response.address = supportStaff.address;
                response.phone = supportStaff.phone;
                response.fullName = supportStaff.fullName;
                response.roleType = supportStaff.roleType;
            }
            // Log audit entry
            yield prisma_config_1.default.auditLog.create({
                data: {
                    action: 'USER_UPDATED',
                    userId,
                    resourceType: 'USER',
                    resourceId: userId,
                    details: `User ${user.email} updated`,
                },
            });
            return response;
        });
    }
    /**
     * Deactivate user account
     */
    static deactivateUser(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_config_1.default.user.findUnique({ where: { id: userId } });
            if (!user) {
                throw new AppError_1.AppError('User not found.', 404);
            }
            if (!user.isActive) {
                throw new AppError_1.AppError('User is already deactivated.', 400);
            }
            const deactivatedUser = yield prisma_config_1.default.user.update({
                where: { id: userId },
                data: { isActive: false },
                select: {
                    id: true,
                    email: true,
                    isActive: true,
                },
            });
            // Log audit entry
            yield prisma_config_1.default.auditLog.create({
                data: {
                    action: 'USER_DEACTIVATED',
                    userId,
                    resourceType: 'USER',
                    resourceId: userId,
                    details: `User ${user.email} deactivated`,
                },
            });
            return deactivatedUser;
        });
    }
    /**
     * Activate user account
     */
    static activateUser(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_config_1.default.user.findUnique({ where: { id: userId } });
            if (!user) {
                throw new AppError_1.AppError('User not found.', 404);
            }
            if (user.isActive) {
                throw new AppError_1.AppError('User is already active.', 400);
            }
            const activatedUser = yield prisma_config_1.default.user.update({
                where: { id: userId },
                data: { isActive: true },
                select: {
                    id: true,
                    email: true,
                    isActive: true,
                },
            });
            // Log audit entry
            yield prisma_config_1.default.auditLog.create({
                data: {
                    action: 'USER_ACTIVATED',
                    userId,
                    resourceType: 'USER',
                    resourceId: userId,
                    details: `User ${user.email} activated`,
                },
            });
            return activatedUser;
        });
    }
    /**
     * Delete user (soft delete)
     */
    static deleteUser(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_config_1.default.user.findUnique({ where: { id: userId } });
            if (!user) {
                throw new AppError_1.AppError('User not found.', 404);
            }
            // Soft delete - set isActive to false
            const deletedUser = yield prisma_config_1.default.user.update({
                where: { id: userId },
                data: { isActive: false },
                select: {
                    id: true,
                    email: true,
                },
            });
            // Log audit entry
            yield prisma_config_1.default.auditLog.create({
                data: {
                    action: 'USER_DELETED',
                    userId,
                    resourceType: 'USER',
                    resourceId: userId,
                    details: `User ${user.email} deleted (soft delete)`,
                },
            });
            return deletedUser;
        });
    }
}
exports.UsersService = UsersService;
exports.default = UsersService;
