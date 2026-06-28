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
const notification_service_1 = require("../../notification/service/notification.service");
const password_util_1 = require("../../../utils/password.util");
const AppError_1 = require("../../../utils/AppError");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const cloudinary_util_1 = require("../../../utils/cloudinary.util");
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
};
function formatUserListItem(user) {
    var _a;
    const response = {
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
        response.approvalStatus = user.student.approvalStatus;
    }
    if (user.teacher) {
        response.teacherProfileId = user.teacher.id;
        response.subjectId = user.teacher.subjectId;
        response.subject = (_a = user.teacher.__subjectName) !== null && _a !== void 0 ? _a : null;
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
class UsersService {
    /**
     * Get all users with role-based filtering and pagination
     */
    static getUsers(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const page = params.page || 1;
            const limit = params.limit || 1000;
            const skip = (page - 1) * limit;
            const where = {};
            // Filter by role if specified
            if (params.role && params.role !== 'all') {
                const roleMap = {
                    managers: client_1.Role.MANAGER,
                    teachers: client_1.Role.TEACHER,
                    students: client_1.Role.STUDENT,
                    admins: client_1.Role.ADMIN,
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
            // Resolve subject names for teachers in a single batch query
            const teacherSubjectIds = formattedUsers
                .filter((u) => u.subjectId)
                .map((u) => u.subjectId);
            if (teacherSubjectIds.length > 0) {
                const subjects = yield prisma_config_1.default.subject.findMany({
                    where: { id: { in: teacherSubjectIds } },
                    select: { id: true, subjectName: true },
                });
                const subjectMap = new Map(subjects.map((s) => [s.id, s.subjectName]));
                formattedUsers.forEach((u) => {
                    var _a;
                    if (u.subjectId) {
                        u.subject = (_a = subjectMap.get(u.subjectId)) !== null && _a !== void 0 ? _a : null;
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
        });
    }
    /**
     * Get user by ID
     */
    static getUserById(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const user = yield prisma_config_1.default.user.findUnique({
                where: { id: userId },
                select: userListSelect,
            });
            if (!user) {
                throw new AppError_1.AppError('User not found.', 404);
            }
            const formatted = formatUserListItem(user);
            // Resolve subject name for teacher
            if (formatted.subjectId) {
                const subject = yield prisma_config_1.default.subject.findUnique({
                    where: { id: formatted.subjectId },
                    select: { subjectName: true },
                });
                formatted.subject = (_a = subject === null || subject === void 0 ? void 0 : subject.subjectName) !== null && _a !== void 0 ? _a : null;
            }
            return formatted;
        });
    }
    /**
     * Approve a student profile (set approvalStatus = APPROVED)
     */
    static approveStudent(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_config_1.default.user.findUnique({ where: { id: userId }, include: { student: true } });
            if (!user)
                throw new AppError_1.AppError('User not found.', 404);
            if (user.role !== client_1.Role.STUDENT)
                throw new AppError_1.AppError('Target user is not a student.', 400);
            if (!user.student)
                throw new AppError_1.AppError('Student profile not found.', 404);
            if (user.student.approvalStatus === 'APPROVED') {
                const currentUser = yield prisma_config_1.default.user.findUnique({ where: { id: userId }, select: userListSelect });
                if (!currentUser)
                    throw new AppError_1.AppError('Error retrieving updated user.', 500);
                return formatUserListItem(currentUser);
            }
            yield prisma_config_1.default.student.update({ where: { userId }, data: { approvalStatus: 'APPROVED' } });
            yield prisma_config_1.default.auditLog.create({
                data: {
                    action: client_1.AuditAction.APPROVE,
                    userId,
                    module: 'STUDENT',
                    description: `Student approved (userId=${userId})`,
                },
            });
            const updatedUser = yield prisma_config_1.default.user.findUnique({ where: { id: userId }, select: userListSelect });
            if (!updatedUser)
                throw new AppError_1.AppError('Error retrieving updated user.', 500);
            return formatUserListItem(updatedUser);
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
            const existingUser = yield prisma_config_1.default.user.findUnique({
                where: { email: dto.email.trim().toLowerCase() },
            });
            if (existingUser) {
                throw new AppError_1.AppError('Email already in use.', 409);
            }
            const providedPassword = typeof dto.password === 'string' && dto.password.trim().length > 0
                ? dto.password.trim()
                : (0, password_util_1.generateTemporaryPassword)(12);
            const hashedPassword = yield (0, password_util_1.hashPassword)(providedPassword);
            const userData = {
                fullName: dto.fullName || `${dto.firstName || ''} ${dto.lastName || ''}`.trim(),
                email: dto.email.trim().toLowerCase(),
                password: hashedPassword,
                phone: dto.phone || dto.phoneNumber || null,
                role,
                isActive: true,
                forcePwdChange: true,
            };
            let user;
            try {
                yield prisma_config_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                    user = yield tx.user.create({
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
                        case client_1.Role.MANAGER:
                            yield tx.manager.create({
                                data: {
                                    userId: user.id,
                                    salary: dto.salary ? new client_1.Prisma.Decimal(dto.salary) : null,
                                    address: dto.address || null,
                                    gender: dto.gender || null,
                                    nic: dto.nic || dto.nicNumber || null,
                                    joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : null,
                                },
                            });
                            break;
                        case client_1.Role.TEACHER:
                            yield tx.teacher.create({
                                data: {
                                    userId: user.id,
                                    subjectId: dto.subjectId || null,
                                    salary: dto.salary ? new client_1.Prisma.Decimal(dto.salary) : null,
                                    address: dto.address || null,
                                    gender: dto.gender || null,
                                    nic: dto.nic || dto.nicNumber || null,
                                    phone: dto.phone || dto.phoneNumber || null,
                                },
                            });
                            break;
                        case client_1.Role.STUDENT:
                            yield tx.student.create({
                                data: {
                                    userId: user.id,
                                    indexNumber: dto.indexNumber || null,
                                    dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
                                    phone: dto.phone || dto.phoneNumber || null,
                                    address: dto.address || null,
                                    gender: dto.gender || null,
                                    batch: dto.batch || null,
                                    nic: dto.nic || dto.nicNumber || null,
                                    approvalStatus: dto.approvalStatus || 'PENDING',
                                },
                            });
                            break;
                        case client_1.Role.ADMIN:
                            yield tx.admin.create({
                                data: {
                                    userId: user.id,
                                    accessLevel: dto.accessLevel || 1,
                                },
                            });
                            break;
                        default:
                            console.warn(`Unknown role: ${role}`);
                    }
                }));
            }
            catch (error) {
                console.error('Error during transactional user creation:', error);
                throw new AppError_1.AppError('Failed to create user account. Please try again.', 500);
            }
            yield prisma_config_1.default.auditLog.create({
                data: {
                    action: client_1.AuditAction.CREATE,
                    userId: user.id,
                    module: 'USER',
                    description: `User ${user.email} created with role ${role}`,
                },
            });
            // Notify all active Admins about the new registration
            try {
                const admins = yield prisma_config_1.default.user.findMany({
                    where: {
                        role: client_1.Role.ADMIN,
                        isActive: true,
                        deletedAt: null,
                    },
                    select: { id: true },
                });
                if (admins.length > 0) {
                    const adminIds = admins.map((a) => a.id);
                    const roleLabel = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase().replace('_', ' ');
                    yield notification_service_1.notificationService.createNotifications({
                        senderId: user.id,
                        receiverIds: adminIds,
                        title: `New ${roleLabel} Registered`,
                        message: `${userData.fullName} created an account.`,
                        type: 'USER_REGISTRATION',
                        referenceType: 'USER',
                        referenceId: user.id,
                    });
                }
            }
            catch (notificationError) {
                console.error('Failed to send registration notifications to admins:', notificationError);
            }
            return { user, temporaryPassword: providedPassword };
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
            const match = yield (0, password_util_1.comparePasswords)(oldPassword, user.password);
            if (!match)
                throw new AppError_1.AppError('Current password is incorrect.', 401);
            const hashed = yield (0, password_util_1.hashPassword)(newPassword);
            yield prisma_config_1.default.user.update({
                where: { id: userId },
                data: { password: hashed, forcePwdChange: false },
            });
            yield prisma_config_1.default.auditLog.create({
                data: {
                    action: client_1.AuditAction.UPDATE,
                    userId,
                    module: 'USER',
                    description: 'User changed own password',
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
                data: { password: hashed, forcePwdChange: true },
                select: { id: true, email: true, role: true, isActive: true, createdAt: true },
            });
            yield prisma_config_1.default.auditLog.create({
                data: {
                    action: client_1.AuditAction.UPDATE,
                    userId: targetUserId,
                    module: 'USER',
                    description: 'Admin reset user password',
                },
            });
            return { user: updated, temporaryPassword };
        });
    }
    /**
     * Admin sets a specific password for a user (used for fixing mismatches).
     * Returns the updated user and echoes back the submitted password so caller can display it.
     */
    static setPasswordForUser(targetUserId, newPassword) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_config_1.default.user.findUnique({ where: { id: targetUserId } });
            if (!user)
                throw new AppError_1.AppError('User not found.', 404);
            const normalized = newPassword.trim();
            const hashed = yield (0, password_util_1.hashPassword)(normalized);
            const updated = yield prisma_config_1.default.user.update({
                where: { id: targetUserId },
                data: { password: hashed, forcePwdChange: true },
                select: { id: true, email: true, role: true, isActive: true, createdAt: true },
            });
            yield prisma_config_1.default.auditLog.create({
                data: {
                    action: client_1.AuditAction.UPDATE,
                    userId: targetUserId,
                    module: 'USER',
                    description: 'Admin set user password',
                },
            });
            return { user: updated, temporaryPassword: newPassword };
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
                    admin: true,
                },
            });
            if (!user) {
                throw new AppError_1.AppError('User not found.', 404);
            }
            if (dto.email && dto.email !== user.email) {
                const existingEmail = yield prisma_config_1.default.user.findUnique({
                    where: { email: dto.email.toLowerCase() },
                });
                if (existingEmail) {
                    throw new AppError_1.AppError('Email already in use.', 409);
                }
            }
            const updateData = {};
            if (dto.email)
                updateData.email = dto.email.toLowerCase();
            if (dto.fullName)
                updateData.fullName = dto.fullName;
            else if (dto.firstName || dto.lastName) {
                const existingFirstName = dto.firstName || '';
                const existingLastName = dto.lastName || '';
                updateData.fullName = `${existingFirstName} ${existingLastName}`.trim();
            }
            if (dto.phoneNumber)
                updateData.phone = dto.phoneNumber;
            if (dto.profileImage !== undefined)
                updateData.profileImage = dto.profileImage;
            if (Object.keys(updateData).length > 0) {
                yield prisma_config_1.default.user.update({
                    where: { id: userId },
                    data: updateData,
                });
            }
            try {
                switch (user.role) {
                    case client_1.Role.MANAGER: {
                        const managerUpdateData = {};
                        if (dto.nicNumber !== undefined)
                            managerUpdateData.nic = dto.nicNumber;
                        if (dto.gender !== undefined)
                            managerUpdateData.gender = dto.gender;
                        if (dto.address !== undefined)
                            managerUpdateData.address = dto.address;
                        if (dto.salary !== undefined)
                            managerUpdateData.salary = dto.salary ? new client_1.Prisma.Decimal(dto.salary) : null;
                        if (Object.keys(managerUpdateData).length > 0) {
                            yield prisma_config_1.default.manager.update({
                                where: { userId },
                                data: managerUpdateData,
                            });
                        }
                        break;
                    }
                    case client_1.Role.TEACHER: {
                        const teacherUpdateData = {};
                        if (dto.subject !== undefined)
                            teacherUpdateData.subjectId = dto.subject; // assume subjectId is passed in dto.subject
                        if (dto.nicNumber !== undefined)
                            teacherUpdateData.nic = dto.nicNumber;
                        if (dto.gender !== undefined)
                            teacherUpdateData.gender = dto.gender;
                        if (dto.address !== undefined)
                            teacherUpdateData.address = dto.address;
                        if (dto.salary !== undefined)
                            teacherUpdateData.salary = dto.salary ? new client_1.Prisma.Decimal(dto.salary) : null;
                        if (dto.phoneNumber !== undefined)
                            teacherUpdateData.phone = dto.phoneNumber;
                        if (Object.keys(teacherUpdateData).length > 0) {
                            yield prisma_config_1.default.teacher.update({
                                where: { userId },
                                data: teacherUpdateData,
                            });
                        }
                        break;
                    }
                    case client_1.Role.STUDENT: {
                        const studentUpdateData = {};
                        if (dto.indexNumber !== undefined)
                            studentUpdateData.indexNumber = dto.indexNumber;
                        if (dto.address !== undefined)
                            studentUpdateData.address = dto.address;
                        if (dto.phoneNumber !== undefined)
                            studentUpdateData.phone = dto.phoneNumber;
                        if (dto.gender !== undefined)
                            studentUpdateData.gender = dto.gender;
                        if (dto.nicNumber !== undefined)
                            studentUpdateData.nic = dto.nicNumber;
                        if (dto.roleType !== undefined)
                            studentUpdateData.batch = dto.roleType; // map roleType to batch if it represents the class batch
                        if (Object.keys(studentUpdateData).length > 0) {
                            yield prisma_config_1.default.student.update({
                                where: { userId },
                                data: studentUpdateData,
                            });
                        }
                        break;
                    }
                }
            }
            catch (error) {
                console.error('Error updating role-specific record:', error);
            }
            const updatedUserWithData = yield prisma_config_1.default.user.findUnique({
                where: { id: userId },
                include: {
                    student: true,
                    teacher: true,
                    manager: true,
                    admin: true,
                },
            });
            if (!updatedUserWithData) {
                throw new AppError_1.AppError('Error retrieving updated user.', 500);
            }
            yield prisma_config_1.default.auditLog.create({
                data: {
                    action: client_1.AuditAction.UPDATE,
                    userId,
                    module: 'USER',
                    description: `User ${user.email} updated`,
                },
            });
            // Send profile update notification
            try {
                yield notification_service_1.notificationService.createNotification({
                    senderId: null,
                    receiverId: userId,
                    title: 'Profile Updated',
                    message: 'Your account profile information has been successfully updated.',
                    type: 'SYSTEM',
                    referenceType: 'PROFILE',
                    referenceId: userId,
                });
            }
            catch (err) {
                console.error('Failed to trigger profile update notification:', err);
            }
            return formatUserListItem(updatedUserWithData);
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
            yield prisma_config_1.default.auditLog.create({
                data: {
                    action: client_1.AuditAction.UPDATE,
                    userId,
                    module: 'USER',
                    description: `User ${user.email} deactivated`,
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
            yield prisma_config_1.default.auditLog.create({
                data: {
                    action: client_1.AuditAction.UPDATE,
                    userId,
                    module: 'USER',
                    description: `User ${user.email} activated`,
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
            const deletedUser = yield prisma_config_1.default.user.update({
                where: { id: userId },
                data: { isActive: false, deletedAt: new Date() },
                select: {
                    id: true,
                    email: true,
                },
            });
            yield prisma_config_1.default.auditLog.create({
                data: {
                    action: client_1.AuditAction.DELETE,
                    userId,
                    module: 'USER',
                    description: `User ${user.email} deleted (soft delete)`,
                },
            });
            return deletedUser;
        });
    }
    /**
     * Update profile image
     */
    static updateProfileImage(userId, imageUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_config_1.default.user.findUnique({
                where: { id: userId },
                select: { profileImage: true, email: true },
            });
            if (!user) {
                throw new AppError_1.AppError('User not found.', 404);
            }
            // If there is an old profile image, try to delete it to save space
            if (user.profileImage) {
                if (user.profileImage.startsWith('/uploads/profile/')) {
                    try {
                        const oldImagePath = path_1.default.join(__dirname, '../../../../', user.profileImage);
                        yield promises_1.default.unlink(oldImagePath);
                    }
                    catch (err) {
                        console.error(`Failed to delete old local profile image: ${user.profileImage}`, err);
                        // Continue even if delete fails
                    }
                }
                else if (user.profileImage.includes('res.cloudinary.com')) {
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
                            yield (0, cloudinary_util_1.deleteCloudinaryImage)(publicId);
                        }
                    }
                    catch (err) {
                        console.error(`Failed to delete old Cloudinary image: ${user.profileImage}`, err);
                    }
                }
            }
            const updatedUser = yield prisma_config_1.default.user.update({
                where: { id: userId },
                data: { profileImage: imageUrl },
            });
            yield prisma_config_1.default.auditLog.create({
                data: {
                    action: client_1.AuditAction.UPDATE,
                    userId,
                    module: 'USER',
                    description: `User ${user.email} updated profile image`,
                },
            });
            return formatUserListItem(updatedUser);
        });
    }
    /**
     * Get admin dashboard stats (counts and recent registrations)
     */
    static getAdminDashboardStats() {
        return __awaiter(this, void 0, void 0, function* () {
            const [totalStudents, totalTeachers, totalManagers, totalAdmins, totalSubjects, totalBatches, recentAdmins,] = yield Promise.all([
                prisma_config_1.default.student.count({ where: { deletedAt: null } }),
                prisma_config_1.default.teacher.count({ where: { deletedAt: null } }),
                prisma_config_1.default.manager.count({ where: { deletedAt: null } }),
                prisma_config_1.default.admin.count(),
                prisma_config_1.default.subject.count({ where: { isActive: true } }),
                prisma_config_1.default.batch.count({ where: { isActive: true } }),
                prisma_config_1.default.user.findMany({
                    where: {
                        role: client_1.Role.ADMIN,
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
        });
    }
}
exports.UsersService = UsersService;
exports.default = UsersService;
