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
function generateSubjectCode(name) {
    const normalized = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return (normalized || 'SUBJECT').slice(0, 20);
}
function ensureUniqueSubjectCode(baseCode) {
    return __awaiter(this, void 0, void 0, function* () {
        let code = baseCode;
        let suffix = 1;
        while (yield prisma_config_1.default.subject.findUnique({ where: { code } })) {
            const suffixText = String(suffix);
            code = `${baseCode.slice(0, Math.max(1, 20 - suffixText.length))}${suffixText}`;
            suffix += 1;
        }
        return code;
    });
}
function validateStreamIds(streamIds) {
    return __awaiter(this, void 0, void 0, function* () {
        const uniqueIds = Array.from(new Set(streamIds));
        if (uniqueIds.length === 0) {
            throw new AppError_1.AppError('At least one stream is required.', 400);
        }
        const streams = yield prisma_config_1.default.stream.findMany({
            where: {
                id: { in: uniqueIds },
                isActive: true,
            },
            select: { id: true },
        });
        if (streams.length !== uniqueIds.length) {
            throw new AppError_1.AppError('One or more selected streams were not found.', 404);
        }
        return uniqueIds;
    });
}
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
function resolveStudentReference(referenceId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const studentByStudentId = yield prisma_config_1.default.student.findUnique({
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
        if (studentByStudentId) {
            if (!((_a = studentByStudentId.user) === null || _a === void 0 ? void 0 : _a.isActive)) {
                throw new AppError_1.AppError('Student is inactive.', 403);
            }
            return studentByStudentId;
        }
        const studentByUserId = yield prisma_config_1.default.student.findUnique({
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
        if (studentByUserId) {
            if (!((_b = studentByUserId.user) === null || _b === void 0 ? void 0 : _b.isActive)) {
                throw new AppError_1.AppError('Student is inactive.', 403);
            }
            return studentByUserId;
        }
        return null;
    });
}
function findSubjectByIdentifier(identifier) {
    return __awaiter(this, void 0, void 0, function* () {
        const numericId = Number(identifier);
        if (Number.isInteger(numericId)) {
            const subjectById = yield prisma_config_1.default.subject.findUnique({
                where: { id: numericId },
                include: {
                    subjectStreams: {
                        include: {
                            stream: true,
                        },
                    },
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
            if (subjectById) {
                return subjectById;
            }
        }
        return prisma_config_1.default.subject.findUnique({
            where: { code: identifier },
            include: {
                subjectStreams: {
                    include: {
                        stream: true,
                    },
                },
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
    });
}
function resolveEnrollmentStudentId(dto, actor) {
    return __awaiter(this, void 0, void 0, function* () {
        if ((actor === null || actor === void 0 ? void 0 : actor.userRole) === client_1.UserRole.STUDENT) {
            if (!actor.userId) {
                throw new AppError_1.AppError('Student profile not found.', 403);
            }
            const student = yield getStudentProfileByUserId(actor.userId);
            if (!student) {
                throw new AppError_1.AppError('Student profile not found.', 403);
            }
            return student.id;
        }
        if (dto.studentId) {
            return dto.studentId;
        }
        if (dto.userId) {
            const student = yield resolveStudentReference(dto.userId);
            if (!student) {
                throw new AppError_1.AppError('Student profile not found.', 403);
            }
            return student.id;
        }
        throw new AppError_1.AppError('Student ID is required for enrollment.', 400);
    });
}
function buildSubjectResponse(subject, activeEnrollmentCount = 0, currentTeacherId) {
    var _a, _b, _c;
    return {
        id: subject.id,
        name: subject.name,
        feePerMonth: decimalToNumber(subject.feePerMonth),
        description: subject.description,
        teacherId: subject.teacherId,
        isActive: subject.isActive,
        createdAt: subject.createdAt,
        streams: ((_a = subject.subjectStreams) !== null && _a !== void 0 ? _a : []).map((subjectStream) => ({
            id: subjectStream.stream.id,
            name: subjectStream.stream.name,
            isActive: subjectStream.stream.isActive,
        })),
        teacher: subject.teacher
            ? {
                id: subject.teacher.id,
                firstName: subject.teacher.firstName,
                lastName: subject.teacher.lastName,
                specialization: subject.teacher.specialization,
                isActive: (_c = (_b = subject.teacher.user) === null || _b === void 0 ? void 0 : _b.isActive) !== null && _c !== void 0 ? _c : true,
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
    static getStreams() {
        return __awaiter(this, void 0, void 0, function* () {
            const streams = yield prisma_config_1.default.stream.findMany({
                where: { isActive: true },
                orderBy: { name: 'asc' },
            });
            return streams;
        });
    }
    static getAvailableSubjects() {
        return __awaiter(this, void 0, void 0, function* () {
            const subjects = yield prisma_config_1.default.subject.findMany({
                where: { isActive: true },
                orderBy: { name: 'asc' },
                include: {
                    subjectStreams: {
                        include: {
                            stream: true,
                        },
                    },
                },
            });
            return subjects.map((sub) => {
                var _a;
                return ({
                    id: sub.id,
                    name: sub.name,
                    streams: ((_a = sub.subjectStreams) !== null && _a !== void 0 ? _a : []).map((ss) => ss.stream.name),
                    feePerMonth: decimalToNumber(sub.feePerMonth),
                });
            });
        });
    }
    static createStream(dto, actor) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const stream = yield prisma_config_1.default.stream.create({
                data: {
                    name: dto.name,
                },
            });
            yield prisma_config_1.default.auditLog.create({
                data: {
                    action: 'STREAM_CREATED',
                    userId: (_a = actor === null || actor === void 0 ? void 0 : actor.userId) !== null && _a !== void 0 ? _a : null,
                    resourceType: 'STREAM',
                    resourceId: stream.id,
                    details: JSON.stringify({ name: stream.name }),
                },
            });
            return stream;
        });
    }
    static createSubject(dto, actor) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const streamIds = yield validateStreamIds(dto.streamIds);
            const requestedCode = dto.code ? dto.code.toUpperCase() : generateSubjectCode(dto.name);
            const code = yield ensureUniqueSubjectCode(requestedCode);
            const subject = yield prisma_config_1.default.subject.create({
                data: {
                    name: dto.name,
                    code,
                    feePerMonth: new client_1.Prisma.Decimal(dto.feePerMonth),
                    description: dto.description,
                    isActive: (_a = dto.isActive) !== null && _a !== void 0 ? _a : true,
                    subjectStreams: {
                        createMany: {
                            data: streamIds.map((streamId) => ({ streamId })),
                        },
                    },
                },
                include: {
                    subjectStreams: {
                        include: {
                            stream: true,
                        },
                    },
                },
            });
            yield prisma_config_1.default.auditLog.create({
                data: {
                    action: 'SUBJECT_CREATED',
                    userId: (_b = actor === null || actor === void 0 ? void 0 : actor.userId) !== null && _b !== void 0 ? _b : null,
                    resourceType: 'SUBJECT',
                    resourceId: subject.id,
                    details: JSON.stringify({
                        name: subject.name,
                        code: subject.code,
                        feePerMonth: subject.feePerMonth.toString(),
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
            if (params.streamId) {
                where.subjectStreams = {
                    some: {
                        streamId: params.streamId,
                    },
                };
            }
            if (params.search) {
                where.OR = [
                    { name: { contains: params.search, mode: 'insensitive' } },
                    { code: { contains: params.search, mode: 'insensitive' } },
                ];
            }
            const [subjects, currentTeacher] = yield Promise.all([
                prisma_config_1.default.subject.findMany({
                    where,
                    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
                    include: {
                        subjectStreams: {
                            include: {
                                stream: true,
                            },
                        },
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
    static getSubjectTeachers(subjectId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
            const subject = yield prisma_config_1.default.subject.findUnique({
                where: { id: subjectId },
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
                    materials: {
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
                    },
                },
            });
            if (!subject) {
                throw new AppError_1.AppError('Subject not found.', 404);
            }
            const teachersById = new Map();
            const subjectTeachers = yield prisma_config_1.default.teacher.findMany({
                where: {
                    specialization: {
                        equals: subject.name,
                        mode: 'insensitive',
                    },
                    user: {
                        isActive: true,
                    },
                },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    specialization: true,
                    user: {
                        select: {
                            isActive: true,
                        },
                    },
                },
                orderBy: {
                    firstName: 'asc',
                },
            });
            for (const teacher of subjectTeachers) {
                teachersById.set(teacher.id, {
                    id: teacher.id,
                    name: `${(_a = teacher.firstName) !== null && _a !== void 0 ? _a : ''} ${(_b = teacher.lastName) !== null && _b !== void 0 ? _b : ''}`.trim(),
                    qualification: (_c = teacher.specialization) !== null && _c !== void 0 ? _c : '',
                    isActive: (_e = (_d = teacher.user) === null || _d === void 0 ? void 0 : _d.isActive) !== null && _e !== void 0 ? _e : true,
                });
            }
            if (subject.teacher) {
                teachersById.set(subject.teacher.id, {
                    id: subject.teacher.id,
                    name: `${(_f = subject.teacher.firstName) !== null && _f !== void 0 ? _f : ''} ${(_g = subject.teacher.lastName) !== null && _g !== void 0 ? _g : ''}`.trim(),
                    qualification: (_h = subject.teacher.specialization) !== null && _h !== void 0 ? _h : '',
                    isActive: (_k = (_j = subject.teacher.user) === null || _j === void 0 ? void 0 : _j.isActive) !== null && _k !== void 0 ? _k : true,
                });
            }
            for (const material of (_l = subject.materials) !== null && _l !== void 0 ? _l : []) {
                const teacher = material.teacher;
                if (!teacher || teachersById.has(teacher.id)) {
                    continue;
                }
                teachersById.set(teacher.id, {
                    id: teacher.id,
                    name: `${(_m = teacher.firstName) !== null && _m !== void 0 ? _m : ''} ${(_o = teacher.lastName) !== null && _o !== void 0 ? _o : ''}`.trim(),
                    qualification: (_p = teacher.specialization) !== null && _p !== void 0 ? _p : '',
                    isActive: (_r = (_q = teacher.user) === null || _q === void 0 ? void 0 : _q.isActive) !== null && _r !== void 0 ? _r : true,
                });
            }
            return Array.from(teachersById.values());
        });
    }
    static getSubjectByIdentifier(identifier, actor) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const subject = yield findSubjectByIdentifier(identifier);
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
            var _a, _b, _c;
            const existing = yield prisma_config_1.default.subject.findUnique({
                where: { id: subjectId },
            });
            if (!existing) {
                throw new AppError_1.AppError('Subject not found.', 404);
            }
            const streamIds = dto.streamIds === undefined
                ? undefined
                : yield validateStreamIds(dto.streamIds);
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
            if (dto.isActive !== undefined) {
                data.isActive = dto.isActive;
            }
            if (streamIds !== undefined) {
                data.subjectStreams = {
                    deleteMany: {},
                    createMany: {
                        data: streamIds.map((streamId) => ({ streamId })),
                    },
                };
            }
            const updated = yield prisma_config_1.default.subject.update({
                where: { id: subjectId },
                data,
                include: {
                    subjectStreams: {
                        include: {
                            stream: true,
                        },
                    },
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
                yield prisma_config_1.default.auditLog.create({
                    data: {
                        action: 'SUBJECT_FEE_UPDATED',
                        userId: (_a = actor === null || actor === void 0 ? void 0 : actor.userId) !== null && _a !== void 0 ? _a : null,
                        resourceType: 'SUBJECT',
                        resourceId: updated.id,
                        details: JSON.stringify({
                            previousFeePerMonth: existing.feePerMonth.toString(),
                            newFeePerMonth: updated.feePerMonth.toString(),
                        }),
                    },
                });
            }
            if (dto.isActive !== undefined && existing.isActive !== dto.isActive) {
                yield prisma_config_1.default.auditLog.create({
                    data: {
                        action: dto.isActive ? 'SUBJECT_ACTIVATED' : 'SUBJECT_DEACTIVATED',
                        userId: (_b = actor === null || actor === void 0 ? void 0 : actor.userId) !== null && _b !== void 0 ? _b : null,
                        resourceType: 'SUBJECT',
                        resourceId: updated.id,
                        details: JSON.stringify({
                            previousIsActive: existing.isActive,
                            newIsActive: dto.isActive,
                        }),
                    },
                });
            }
            if (streamIds !== undefined) {
                yield prisma_config_1.default.auditLog.create({
                    data: {
                        action: 'SUBJECT_STREAMS_UPDATED',
                        userId: (_c = actor === null || actor === void 0 ? void 0 : actor.userId) !== null && _c !== void 0 ? _c : null,
                        resourceType: 'SUBJECT',
                        resourceId: updated.id,
                        details: JSON.stringify({
                            streamIds,
                        }),
                    },
                });
            }
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
                    subjectStreams: {
                        include: {
                            stream: true,
                        },
                    },
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
    static assignTeacher(subjectIdentifier, teacherId, actor) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Resolve subject by ID or code
            const subject = typeof subjectIdentifier === 'string' && Number.isNaN(Number(subjectIdentifier))
                ? yield prisma_config_1.default.subject.findUnique({ where: { code: subjectIdentifier }, select: { id: true } })
                : yield prisma_config_1.default.subject.findUnique({ where: { id: Number(subjectIdentifier) }, select: { id: true } });
            if (!subject) {
                throw new AppError_1.AppError('Subject not found.', 404);
            }
            const teacher = yield resolveTeacherReference(teacherId);
            if (!teacher) {
                throw new AppError_1.AppError('Teacher not found. Use the teacher table id or the linked user id.', 404);
            }
            const updatedSubject = yield prisma_config_1.default.subject.update({
                where: { id: subject.id },
                data: {
                    teacherId: teacher.id,
                },
                include: {
                    subjectStreams: {
                        include: { stream: true },
                    },
                    teacher: {
                        include: { user: { select: { isActive: true } } },
                    },
                },
            });
            yield prisma_config_1.default.auditLog.create({
                data: {
                    action: 'SUBJECT_TEACHER_ASSIGNED',
                    userId: (_a = actor === null || actor === void 0 ? void 0 : actor.userId) !== null && _a !== void 0 ? _a : null,
                    resourceType: 'SUBJECT',
                    resourceId: subject.id,
                    details: JSON.stringify({ teacherId: teacher.id }),
                },
            });
            return buildSubjectResponse(updatedSubject, 0);
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
            const studentId = yield resolveEnrollmentStudentId(dto, actor);
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
