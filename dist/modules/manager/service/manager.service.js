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
exports.ManagerService = void 0;
const prisma_config_1 = __importDefault(require("../../../config/prisma.config"));
const AppError_1 = require("../../../utils/AppError");
class ManagerService {
    /**
     * Get all newly registered students
     */
    static getRegisteredStudents() {
        return __awaiter(this, void 0, void 0, function* () {
            const students = yield prisma_config_1.default.student.findMany({
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            fullName: true,
                            email: true,
                            isActive: true,
                        },
                    },
                    stream: {
                        select: {
                            streamName: true,
                        },
                    },
                },
            });
            return students.map((student) => {
                var _a;
                return ({
                    id: student.id,
                    studentName: student.user.fullName,
                    email: student.user.email,
                    stream: ((_a = student.stream) === null || _a === void 0 ? void 0 : _a.streamName) || 'N/A',
                    totalFeeAmount: Number(student.totalFeeAmount),
                    paymentStatus: student.paymentStatus,
                    approvalStatus: student.approvalStatus,
                    registeredDate: student.createdAt,
                });
            });
        });
    }
    /**
     * Get full details of a specific registered student
     */
    static getRegisteredStudentById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const student = yield prisma_config_1.default.student.findUnique({
                where: { id },
                include: {
                    user: {
                        select: {
                            fullName: true,
                            email: true,
                            isActive: true,
                        },
                    },
                    parent: true,
                    stream: true,
                    enrollments: {
                        include: {
                            subject: true,
                            teacher: {
                                include: {
                                    user: {
                                        select: {
                                            fullName: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });
            if (!student) {
                throw new AppError_1.AppError('Student not found.', 404);
            }
            return student;
        });
    }
    /**
     * Update payment status of a registered student
     */
    static updatePaymentStatus(id, paymentStatus) {
        return __awaiter(this, void 0, void 0, function* () {
            const student = yield prisma_config_1.default.student.findUnique({ where: { id } });
            if (!student)
                throw new AppError_1.AppError('Student not found.', 404);
            return prisma_config_1.default.student.update({
                where: { id },
                data: { paymentStatus },
            });
        });
    }
    /**
     * Update approval status of a registered student
     */
    static updateApprovalStatus(id, approvalStatus) {
        return __awaiter(this, void 0, void 0, function* () {
            const student = yield prisma_config_1.default.student.findUnique({ where: { id } });
            if (!student)
                throw new AppError_1.AppError('Student not found.', 404);
            return prisma_config_1.default.student.update({
                where: { id },
                data: { approvalStatus },
            });
        });
    }
}
exports.ManagerService = ManagerService;
exports.default = ManagerService;
