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
exports.SubjectsService = void 0;
const client_1 = require("@prisma/client");
const prisma_config_1 = __importDefault(require("../../../config/prisma.config"));
const AppError_1 = require("../../../utils/AppError");
function decimalToNumber(value) {
    if (value === null || value === undefined) {
        return null;
    }
    return typeof value === 'number' ? value : Number(value);
}
function getTeacherProfileByUserId(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        return prisma_config_1.default.teacher.findUnique({
            where: { userId },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                user: {
                    select: {
                        isActive: true,
                    },
                },
            },
        });
    });
}
function getStudentProfileByUserId(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        return prisma_config_1.default.student.findUnique({
            where: { userId },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                indexNumber: true,
                user: {
                    select: {
                        isActive: true,
                    },
                },
            },
        });
    });
}
function resolveTeacherReference(referenceId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const teacherByTeacherId = yield prisma_config_1.default.teacher.findUnique({
            where: { id: referenceId },
            select: {
                id: true,
                userId: true,
                user: {
                    select: {
                        isActive: true,
                    },
                },
            },
        });
        if (teacherByTeacherId) {
            if (!((_a = teacherByTeacherId.user) === null || _a === void 0 ? void 0 : _a.isActive)) {
                throw new AppError_1.AppError('Teacher is inactive.', 403);
            }
            return teacherByTeacherId;
        }
        const teacherByUserId = yield prisma_config_1.default.teacher.findUnique({
            where: { userId: referenceId },
            select: {
                id: true,
                userId: true,
                user: {
                    select: {
                        isActive: true,
                    },
                },
            },
        });
        if (teacherByUserId) {
            if (!((_b = teacherByUserId.user) === null || _b === void 0 ? void 0 : _b.isActive)) {
                throw new AppError_1.AppError('Teacher is inactive.', 403);
            }
            return teacherByUserId;
        }
        return null;
    });
}
function buildSubjectResponse(subject, activeEnrollmentCount = 0, currentTeacherId) {
    var _a, _b;
    return {
        id: subject.id,
        name: subject.name,
        code: subject.code,
        feePerMonth: decimalToNumber(subject.feePerMonth),
        description: subject.description,
        teacherId: subject.teacherId,
        isActive: subject.isActive,
        createdAt: subject.createdAt,
        teacher: subject.teacher
            ? {
                id: subject.teacher.id,
                firstName: subject.teacher.firstName,
                lastName: subject.teacher.lastName,
                specialization: subject.teacher.specialization,
                isActive: (_b = (_a = subject.teacher.user) === null || _a === void 0 ? void 0 : _a.isActive) !== null && _b !== void 0 ? _b : true,
            }
            : null,
        activeEnrollmentCount,
        isAssignedToMe: currentTeacherId ? subject.teacherId === currentTeacherId : false,
    };
}
function getActiveEnrollmentCountMap(subjectIds) {
    return __awaiter(this, void 0, void 0, function* () {
        if (subjectIds.length === 0) {
            return new Map();
        }
        const grouped = yield prisma_config_1.default.enrollment.groupBy({
            by: ['subjectId'],
            where: {
                subjectId: { in: subjectIds },
                isActive: true,
            },
            _count: {
                _all: true,
            },
        });
        return new Map(grouped.map((item) => [item.subjectId, item._count._all]));
    });
}
class SubjectsService {
    static createSubject(dto, actor) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const teacher = yield resolveTeacherReference(dto.teacherId);
            if (!teacher) {
                throw new AppError_1.AppError('Teacher not found. Use the teacher table id or the linked user id.', 404);
            }
            const subject = yield prisma_config_1.default.subject.create({
                data: {
                    name: dto.name,
                    code: dto.code,
                    feePerMonth: new client_1.Prisma.Decimal(dto.feePerMonth),
                    teacherId: teacher.id,
                    description: dto.description,
                },
                include: {
                    teacher: {
                        include: {
                            user: {
                                select: {
                                    isActive: true,
                                },
                            },
                        },
                    },
                },
            });
            yield prisma_config_1.default.auditLog.create({
                data: {
                    action: 'SUBJECT_CREATED',
                    userId: (_a = actor === null || actor === void 0 ? void 0 : actor.userId) !== null && _a !== void 0 ? _a : null,
                    resourceType: 'SUBJECT',
                    resourceId: subject.id,
                    details: JSON.stringify({
                        name: subject.name,
                        code: subject.code,
                        feePerMonth: subject.feePerMonth.toString(),
                        teacherId: subject.teacherId,
                    }),
                },
            });
            return buildSubjectResponse(subject, 0);
        });
    }
    static getSubjects(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const where = {};
            if (params.userRole === client_1.UserRole.STUDENT && params.active === undefined) {
                where.isActive = true;
            }
            else if (params.active !== undefined) {
                where.isActive = params.active;
            }
            if (params.teacherId) {
                where.teacherId = params.teacherId;
            }
            if (params.code) {
                where.code = { equals: params.code, mode: 'insensitive' };
            }
            if (params.search) {
                where.code = { contains: params.search, mode: 'insensitive' };
            }
            const [subjects, currentTeacher] = yield Promise.all([
                prisma_config_1.default.subject.findMany({
                    where,
                    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
                    include: {
                        teacher: {
                            include: {
                                user: {
                                    select: {
                                        isActive: true,
                                    },
                                },
                            },
                        },
                    },
                }),
                params.userRole === client_1.UserRole.TEACHER && params.userId ? getTeacherProfileByUserId(params.userId) : Promise.resolve(null),
            ]);
            const subjectIds = subjects.map((subject) => subject.id);
            const activeCounts = yield getActiveEnrollmentCountMap(subjectIds);
            return {
                data: subjects.map((subject) => { var _a, _b; return buildSubjectResponse(subject, (_a = activeCounts.get(subject.id)) !== null && _a !== void 0 ? _a : 0, (_b = currentTeacher === null || currentTeacher === void 0 ? void 0 : currentTeacher.id) !== null && _b !== void 0 ? _b : undefined); }),
                total: subjects.length,
                page: 1,
                limit: subjects.length,
                hasMore: false,
            };
        });
    }
    static getSubjectByIdentifier(identifier, actor) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const numericId = Number(identifier);
            let subject = Number.isInteger(numericId)
                ? yield prisma_config_1.default.subject.findUnique({
                    where: { id: numericId },
                    include: {
                        teacher: {
                            include: {
                                user: {
                                    select: {
                                        isActive: true,
                                    },
                                },
                            },
                        },
                    },
                })
                : null;
            if (!subject) {
                subject = yield prisma_config_1.default.subject.findUnique({
                    where: { code: identifier },
                    include: {
                        teacher: {
                            include: {
                                user: {
                                    select: {
                                        isActive: true,
                                    },
                                },
                            },
                        },
                    },
                });
            }
            if (!subject) {
                throw new AppError_1.AppError('Subject not found.', 404);
            }
            if (!subject.isActive && (actor === null || actor === void 0 ? void 0 : actor.userRole) === client_1.UserRole.STUDENT) {
                throw new AppError_1.AppError('Subject not found.', 404);
            }
            const activeEnrollmentCount = yield prisma_config_1.default.enrollment.count({
                where: {
                    subjectId: subject.id,
                    isActive: true,
                },
            });
            const currentTeacher = (actor === null || actor === void 0 ? void 0 : actor.userRole) === client_1.UserRole.TEACHER && actor.userId
                ? yield getTeacherProfileByUserId(actor.userId)
                : null;
            return buildSubjectResponse(subject, activeEnrollmentCount, (_a = currentTeacher === null || currentTeacher === void 0 ? void 0 : currentTeacher.id) !== null && _a !== void 0 ? _a : undefined);
        });
    }
    static updateSubject(subjectId, dto, actor) {
        return __awaiter(this, void 0, void 0, function* () {
            const existing = yield prisma_config_1.default.subject.findUnique({
                where: { id: subjectId },
            });
            if (!existing) {
                throw new AppError_1.AppError('Subject not found.', 404);
            }
            const updated = yield prisma_config_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const data = {};
                if (dto.name !== undefined) {
                    data.name = dto.name;
                }
                if (dto.code !== undefined) {
                    data.code = dto.code;
                }
                if (dto.description !== undefined) {
                    data.description = dto.description;
                }
                if (dto.feePerMonth !== undefined) {
                    data.feePerMonth = new client_1.Prisma.Decimal(dto.feePerMonth);
                }
                const subject = yield tx.subject.update({
                    where: { id: subjectId },
                    data,
                    include: {
                        teacher: {
                            include: {
                                user: {
                                    select: {
                                        isActive: true,
                                    },
                                },
                            },
                        },
                    },
                });
                if (dto.feePerMonth !== undefined && decimalToNumber(existing.feePerMonth) !== dto.feePerMonth) {
                    yield tx.auditLog.create({
                        data: {
                            action: 'SUBJECT_FEE_UPDATED',
                            userId: (_a = actor === null || actor === void 0 ? void 0 : actor.userId) !== null && _a !== void 0 ? _a : null,
                            resourceType: 'SUBJECT',
                            resourceId: subject.id,
                            details: JSON.stringify({
                                previousFeePerMonth: existing.feePerMonth.toString(),
                                newFeePerMonth: subject.feePerMonth.toString(),
                            }),
                        },
                    });
                }
                return subject;
            }));
            return buildSubjectResponse(updated, 0);
        });
    }
    static deactivateSubject(subjectId, actor) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const subject = yield prisma_config_1.default.subject.findUnique({
                where: { id: subjectId },
            });
            if (!subject) {
                throw new AppError_1.AppError('Subject not found.', 404);
            }
            const activeEnrollmentCount = yield prisma_config_1.default.enrollment.count({
                where: {
                    subjectId,
                    isActive: true,
                },
            });
            if (activeEnrollmentCount > 0 && !(actor === null || actor === void 0 ? void 0 : actor.force)) {
                throw new AppError_1.AppError('Cannot deactivate a subject with active enrollments. Use force=true as an admin.', 409);
            }
            const updated = yield prisma_config_1.default.subject.update({
                where: { id: subjectId },
                data: {
                    isActive: false,
                },
                include: {
                    teacher: {
                        include: {
                            user: {
                                select: {
                                    isActive: true,
                                },
                            },
                        },
                    },
                },
            });
            yield prisma_config_1.default.auditLog.create({
                data: {
                    action: 'SUBJECT_DEACTIVATED',
                    userId: (_a = actor === null || actor === void 0 ? void 0 : actor.userId) !== null && _a !== void 0 ? _a : null,
                    resourceType: 'SUBJECT',
                    resourceId: subjectId,
                    details: JSON.stringify({
                        force: Boolean(actor === null || actor === void 0 ? void 0 : actor.force),
                    }),
                },
            });
            return buildSubjectResponse(updated, activeEnrollmentCount);
        });
    }
    static assignTeacher(subjectId, teacherId, actor) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const teacher = yield resolveTeacherReference(teacherId);
            if (!teacher) {
                throw new AppError_1.AppError('Teacher not found. Use the teacher table id or the linked user id.', 404);
            }
            const subject = yield prisma_config_1.default.subject.update({
                where: { id: subjectId },
                data: {
                    teacherId,
                },
                include: {
                    teacher: {
                        include: {
                            user: {
                                select: {
                                    isActive: true,
                                },
                            },
                        },
                    },
                },
            });
            yield prisma_config_1.default.auditLog.create({
                data: {
                    action: 'SUBJECT_TEACHER_ASSIGNED',
                    userId: (_a = actor === null || actor === void 0 ? void 0 : actor.userId) !== null && _a !== void 0 ? _a : null,
                    resourceType: 'SUBJECT',
                    resourceId: subjectId,
                    details: JSON.stringify({
                        teacherId,
                    }),
                },
            });
            return buildSubjectResponse(subject, 0);
        });
    }
    static getSubjectStudents(subjectId, actor) {
        return __awaiter(this, void 0, void 0, function* () {
            const subject = yield prisma_config_1.default.subject.findUnique({
                where: { id: subjectId },
                select: {
                    id: true,
                    teacherId: true,
                },
            });
            if (!subject) {
                throw new AppError_1.AppError('Subject not found.', 404);
            }
            if ((actor === null || actor === void 0 ? void 0 : actor.userRole) === client_1.UserRole.TEACHER && actor.userId) {
                const teacher = yield getTeacherProfileByUserId(actor.userId);
                if ((teacher === null || teacher === void 0 ? void 0 : teacher.id) !== subject.teacherId) {
                    throw new AppError_1.AppError('You can only view students for your assigned subjects.', 403);
                }
            }
            const enrollments = yield prisma_config_1.default.enrollment.findMany({
                where: {
                    subjectId,
                    isActive: true,
                },
                include: {
                    student: {
                        include: {
                            user: {
                                select: {
                                    isActive: true,
                                    email: true,
                                },
                            },
                        },
                    },
                },
                orderBy: {
                    enrolledAt: 'desc',
                },
            });
            return {
                data: enrollments.map((enrollment) => {
                    var _a, _b;
                    return ({
                        enrollmentId: enrollment.id,
                        studentId: enrollment.studentId,
                        enrolledAt: enrollment.enrolledAt,
                        isActive: enrollment.isActive,
                        student: {
                            id: enrollment.student.id,
                            userId: enrollment.student.userId,
                            firstName: enrollment.student.firstName,
                            lastName: enrollment.student.lastName,
                            indexNumber: enrollment.student.indexNumber,
                            phone: enrollment.student.phone,
                            address: enrollment.student.address,
                            isActive: (_b = (_a = enrollment.student.user) === null || _a === void 0 ? void 0 : _a.isActive) !== null && _b !== void 0 ? _b : true,
                        },
                    });
                }),
                total: enrollments.length,
            };
        });
    }
    static enrollStudent(subjectId, dto, actor) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const subject = yield prisma_config_1.default.subject.findUnique({
                where: { id: subjectId },
                select: {
                    id: true,
                    isActive: true,
                },
            });
            if (!subject) {
                throw new AppError_1.AppError('Subject not found.', 404);
            }
            if (!subject.isActive) {
                throw new AppError_1.AppError('Cannot enroll students in an inactive subject.', 409);
            }
            let studentId = dto.studentId;
            if ((actor === null || actor === void 0 ? void 0 : actor.userRole) === client_1.UserRole.STUDENT) {
                if (!actor.userId) {
                    throw new AppError_1.AppError('Student profile not found.', 403);
                }
                const student = yield getStudentProfileByUserId(actor.userId);
                if (!student) {
                    throw new AppError_1.AppError('Student profile not found.', 403);
                }
                studentId = student.id;
            }
            if (!studentId) {
                throw new AppError_1.AppError('Student ID is required for enrollment.', 400);
            }
            const student = yield prisma_config_1.default.student.findUnique({
                where: { id: studentId },
                select: {
                    id: true,
                    user: {
                        select: {
                            isActive: true,
                        },
                    },
                },
            });
            if (!(student === null || student === void 0 ? void 0 : student.user.isActive)) {
                throw new AppError_1.AppError('Student not found or is not active.', 404);
            }
            const existingEnrollment = yield prisma_config_1.default.enrollment.findFirst({
                where: {
                    studentId,
                    subjectId,
                },
            });
            if (existingEnrollment === null || existingEnrollment === void 0 ? void 0 : existingEnrollment.isActive) {
                throw new AppError_1.AppError('Student is already enrolled in this subject.', 409);
            }
            const enrollment = existingEnrollment
                ? yield prisma_config_1.default.enrollment.update({
                    where: { id: existingEnrollment.id },
                    data: { isActive: true },
                })
                : yield prisma_config_1.default.enrollment.create({
                    data: {
                        studentId,
                        subjectId,
                        isActive: true,
                    },
                });
            yield prisma_config_1.default.auditLog.create({
                data: {
                    action: 'SUBJECT_STUDENT_ENROLLED',
                    userId: (_a = actor === null || actor === void 0 ? void 0 : actor.userId) !== null && _a !== void 0 ? _a : null,
                    resourceType: 'ENROLLMENT',
                    resourceId: enrollment.id,
                    details: JSON.stringify({
                        subjectId,
                        studentId,
                    }),
                },
            });
            return enrollment;
        });
    }
    static unenrollStudent(subjectId, studentId, actor) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const subject = yield prisma_config_1.default.subject.findUnique({
                where: { id: subjectId },
                select: {
                    id: true,
                },
            });
            if (!subject) {
                throw new AppError_1.AppError('Subject not found.', 404);
            }
            if ((actor === null || actor === void 0 ? void 0 : actor.userRole) === client_1.UserRole.STUDENT) {
                if (!actor.userId) {
                    throw new AppError_1.AppError('Student profile not found.', 403);
                }
                const student = yield getStudentProfileByUserId(actor.userId);
                if ((student === null || student === void 0 ? void 0 : student.id) !== studentId) {
                    throw new AppError_1.AppError('You can only unenroll yourself.', 403);
                }
            }
            const enrollment = yield prisma_config_1.default.enrollment.findFirst({
                where: {
                    studentId,
                    subjectId,
                    isActive: true,
                },
            });
            if (!enrollment) {
                throw new AppError_1.AppError('Enrollment not found.', 404);
            }
            const updated = yield prisma_config_1.default.enrollment.update({
                where: { id: enrollment.id },
                data: { isActive: false },
            });
            yield prisma_config_1.default.auditLog.create({
                data: {
                    action: 'SUBJECT_STUDENT_UNENROLLED',
                    userId: (_a = actor === null || actor === void 0 ? void 0 : actor.userId) !== null && _a !== void 0 ? _a : null,
                    resourceType: 'ENROLLMENT',
                    resourceId: updated.id,
                    details: JSON.stringify({
                        subjectId,
                        studentId,
                    }),
                },
            });
            return updated;
        });
    }
    static getEnrollmentCount(subjectId) {
        return __awaiter(this, void 0, void 0, function* () {
            const subject = yield prisma_config_1.default.subject.findUnique({
                where: { id: subjectId },
                select: { id: true },
            });
            if (!subject) {
                throw new AppError_1.AppError('Subject not found.', 404);
            }
            return prisma_config_1.default.enrollment.count({
                where: {
                    subjectId,
                    isActive: true,
                },
            });
        });
    }
}
exports.SubjectsService = SubjectsService;
exports.default = SubjectsService;
