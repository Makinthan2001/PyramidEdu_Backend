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
exports.TeachersService = void 0;
const prisma_config_1 = __importDefault(require("../../../config/prisma.config"));
const client_1 = require("@prisma/client");
const password_util_1 = require("../../../utils/password.util");
const AppError_1 = require("../../../utils/AppError");
/**
 * Service layer for Teacher entity.
 */
class TeachersService {
    static getTeachers(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { page = 1, limit = 10, search } = params;
            const where = {
                deletedAt: null,
            };
            if (search) {
                where.OR = [
                    { user: { fullName: { contains: search, mode: 'insensitive' } } },
                    { nic: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search, mode: 'insensitive' } },
                ];
            }
            const [data, total] = yield Promise.all([
                prisma_config_1.default.teacher.findMany({
                    where,
                    skip: (page - 1) * limit,
                    take: limit,
                    include: { user: true },
                }),
                prisma_config_1.default.teacher.count({ where }),
            ]);
            return { data, total };
        });
    }
    static getTeacherById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_config_1.default.teacher.findFirst({
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
        });
    }
    static getTeacherByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_config_1.default.teacher.findFirst({
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
        });
    }
    static createTeacher(dto) {
        return __awaiter(this, void 0, void 0, function* () {
            const existingUser = yield prisma_config_1.default.user.findUnique({
                where: { email: dto.email.trim().toLowerCase() },
            });
            if (existingUser) {
                throw new AppError_1.AppError('Email already in use.', 409);
            }
            const hashedPassword = yield (0, password_util_1.hashPassword)(dto.password || 'TempPass123!');
            const user = yield prisma_config_1.default.user.create({
                data: {
                    email: dto.email.trim().toLowerCase(),
                    password: hashedPassword,
                    fullName: dto.fullName,
                    role: client_1.Role.TEACHER,
                    isActive: true,
                },
            });
            const teacher = yield prisma_config_1.default.teacher.create({
                data: {
                    userId: user.id,
                    subjectId: dto.subjectId || null,
                    nic: dto.nic,
                    gender: dto.gender,
                    address: dto.address,
                    phone: dto.phone || null,
                    salary: dto.salary ? new client_1.Prisma.Decimal(dto.salary) : null,
                },
                include: { user: true },
            });
            yield prisma_config_1.default.auditLog.create({
                data: {
                    action: client_1.AuditAction.CREATE,
                    userId: user.id,
                    module: 'TEACHER',
                    description: `Teacher profile created for ${user.email}`,
                },
            });
            return teacher;
        });
    }
    static updateTeacher(id, dto) {
        return __awaiter(this, void 0, void 0, function* () {
            const teacher = yield prisma_config_1.default.teacher.findFirst({
                where: { id, deletedAt: null },
            });
            if (!teacher) {
                throw new AppError_1.AppError('Teacher not found', 404);
            }
            const teacherData = {};
            if (dto.phone !== undefined)
                teacherData.phone = dto.phone;
            if (dto.address !== undefined)
                teacherData.address = dto.address;
            if (dto.salary !== undefined)
                teacherData.salary = dto.salary ? new client_1.Prisma.Decimal(dto.salary) : null;
            if (dto.subjectId !== undefined)
                teacherData.subjectId = dto.subjectId;
            if (dto.nic !== undefined)
                teacherData.nic = dto.nic;
            if (dto.gender !== undefined)
                teacherData.gender = dto.gender;
            if (Object.keys(teacherData).length > 0) {
                yield prisma_config_1.default.teacher.update({
                    where: { id },
                    data: teacherData,
                });
            }
            if (dto.fullName) {
                yield prisma_config_1.default.user.update({
                    where: { id: teacher.userId },
                    data: { fullName: dto.fullName },
                });
            }
            yield prisma_config_1.default.auditLog.create({
                data: {
                    action: client_1.AuditAction.UPDATE,
                    userId: teacher.userId,
                    module: 'TEACHER',
                    description: `Teacher profile updated`,
                },
            });
            return prisma_config_1.default.teacher.findUnique({
                where: { id },
                include: { user: true },
            });
        });
    }
    static deleteTeacher(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const teacher = yield prisma_config_1.default.teacher.findUnique({
                where: { id },
                include: { user: true },
            });
            if (!teacher)
                throw new AppError_1.AppError('Teacher not found', 404);
            yield prisma_config_1.default.$transaction([
                prisma_config_1.default.teacher.update({
                    where: { id },
                    data: { deletedAt: new Date() },
                }),
                prisma_config_1.default.user.update({
                    where: { id: teacher.userId },
                    data: { isActive: false },
                }),
            ]);
            yield prisma_config_1.default.auditLog.create({
                data: {
                    action: client_1.AuditAction.DELETE,
                    userId: teacher.userId,
                    module: 'TEACHER',
                    description: `Teacher soft deleted and user deactivated`,
                },
            });
            return teacher;
        });
    }
    static assignSubject(teacherId, dto) {
        return __awaiter(this, void 0, void 0, function* () {
            yield prisma_config_1.default.subjectAllocation.upsert({
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
        });
    }
    static removeSubject(teacherId, dto) {
        return __awaiter(this, void 0, void 0, function* () {
            yield prisma_config_1.default.subjectAllocation.delete({
                where: {
                    teacherId_subjectId: {
                        teacherId,
                        subjectId: dto.subjectId,
                    },
                },
            });
        });
    }
}
exports.TeachersService = TeachersService;
exports.default = TeachersService;
