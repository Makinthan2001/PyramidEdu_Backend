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
/**
 * Service layer for Teacher entity. Mirrors the pattern used in other services.
 */
class TeachersService {
    static getTeachers(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { page = 1, limit = 10, search, specialization } = params;
            const where = {};
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
            return prisma_config_1.default.teacher.findUnique({
                where: { id },
                include: { user: true, subjects: true },
            });
        });
    }
    static createTeacher(dto) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const user = yield prisma_config_1.default.user.create({
                data: {
                    email: dto.email,
                    passwordHash: (_a = dto.password) !== null && _a !== void 0 ? _a : '',
                    role: 'TEACHER',
                    isActive: true,
                },
            });
            const teacher = yield prisma_config_1.default.teacher.create({
                data: {
                    userId: user.id,
                    firstName: dto.firstName,
                    lastName: dto.lastName,
                    nicNumber: dto.nicNumber,
                    gender: dto.gender,
                    address: dto.address,
                    phone: (_b = dto.phone) !== null && _b !== void 0 ? _b : '',
                    specialization: dto.specialization,
                    salary: dto.salary ? new client_1.Prisma.Decimal(dto.salary) : undefined,
                },
            });
            return teacher;
        });
    }
    static updateTeacher(id, dto) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = {};
            if (dto.firstName !== undefined)
                data.firstName = dto.firstName;
            if (dto.lastName !== undefined)
                data.lastName = dto.lastName;
            if (dto.phone !== undefined)
                data.phone = dto.phone;
            if (dto.address !== undefined)
                data.address = dto.address;
            if (dto.specialization !== undefined)
                data.specialization = dto.specialization;
            if (dto.salary !== undefined)
                data.salary = dto.salary ? new client_1.Prisma.Decimal(dto.salary) : null;
            const teacher = yield prisma_config_1.default.teacher.update({ where: { id }, data });
            return teacher;
        });
    }
    static deleteTeacher(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const teacher = yield prisma_config_1.default.teacher.findUnique({ where: { id }, include: { user: true } });
            if (!teacher)
                throw new Error('Teacher not found');
            yield prisma_config_1.default.user.update({ where: { id: teacher.userId }, data: { isActive: false } });
            return teacher;
        });
    }
    static assignSubject(teacherId, dto) {
        return __awaiter(this, void 0, void 0, function* () {
            yield prisma_config_1.default.subject.update({
                where: { id: dto.subjectId },
                data: { teacherId },
            });
        });
    }
    static removeSubject(teacherId, dto) {
        return __awaiter(this, void 0, void 0, function* () {
            const subject = yield prisma_config_1.default.subject.findUnique({ where: { id: dto.subjectId } });
            if ((subject === null || subject === void 0 ? void 0 : subject.teacherId) !== teacherId)
                throw new Error('Subject not assigned to this teacher');
            yield prisma_config_1.default.subject.update({ where: { id: dto.subjectId }, data: { teacherId: null } });
        });
    }
}
exports.TeachersService = TeachersService;
exports.default = TeachersService;
