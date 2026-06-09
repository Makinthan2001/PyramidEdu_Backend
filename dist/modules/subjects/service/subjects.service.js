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
        while (yield prisma_config_1.default.subject.findUnique({ where: { subjectCode: code } })) {
            const suffixText = String(suffix);
            code = `${baseCode.slice(0, Math.max(1, 20 - suffixText.length))}${suffixText}`;
            suffix += 1;
        }
        return code;
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
        // Try finding by UUID
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
        if (isUuid) {
            const subjectById = yield prisma_config_1.default.subject.findUnique({
                where: { id: identifier },
                include: {
                    streams: true,
                    subjectAllocations: {
                        where: { status: client_1.SubjectAllocationStatus.ACTIVE },
                        include: {
                            teacher: {
                                include: {
                                    user: true,
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
            where: { subjectCode: identifier },
            include: {
                streams: true,
                subjectAllocations: {
                    where: { status: client_1.SubjectAllocationStatus.ACTIVE },
                    include: {
                        teacher: {
                            include: {
                                user: true,
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
        if ((actor === null || actor === void 0 ? void 0 : actor.userRole) === client_1.Role.STUDENT) {
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
    var _a, _b, _c, _d, _e, _f;
    // Get active teacher from allocations
    const activeAllocation = (_a = subject.subjectAllocations) === null || _a === void 0 ? void 0 : _a.find((alloc) => alloc.status === client_1.SubjectAllocationStatus.ACTIVE);
    const teacher = activeAllocation === null || activeAllocation === void 0 ? void 0 : activeAllocation.teacher;
    // Support both streams[] (many-to-many) and legacy single stream
    const streamsArray = (_b = subject.streams) !== null && _b !== void 0 ? _b : (subject.stream ? [subject.stream] : []);
    const primaryStream = (_c = streamsArray[0]) !== null && _c !== void 0 ? _c : null;
    return {
        id: subject.id,
        name: subject.subjectName,
        code: subject.subjectCode,
        feePerMonth: decimalToNumber(subject.feeAmount),
        isActive: subject.isActive,
        createdAt: subject.createdAt,
        // Full array for multi-stream display
        streams: streamsArray.map((s) => ({
            id: s.id,
            name: s.streamName,
            isActive: s.isActive,
        })),
        // Legacy single-stream field for backwards compat
        stream: primaryStream
            ? {
                id: primaryStream.id,
                name: primaryStream.streamName,
                isActive: primaryStream.isActive,
            }
            : null,
        teacher: teacher
            ? {
                id: teacher.id,
                name: ((_d = teacher.user) === null || _d === void 0 ? void 0 : _d.fullName) || '',
                isActive: (_f = (_e = teacher.user) === null || _e === void 0 ? void 0 : _e.isActive) !== null && _f !== void 0 ? _f : true,
            }
            : null,
        activeEnrollmentCount,
        isAssignedToMe: currentTeacherId && teacher ? teacher.id === currentTeacherId : false,
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
                enrollmentStatus: client_1.EnrollmentStatus.ACTIVE,
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
            return prisma_config_1.default.stream.findMany({
                where: { isActive: true },
                orderBy: { streamName: 'asc' },
                include: {
                    batches: true,
                },
            });
        });
    }
    static getAvailableSubjects() {
        return __awaiter(this, void 0, void 0, function* () {
            const subjects = yield prisma_config_1.default.subject.findMany({
                where: { isActive: true },
                orderBy: { subjectName: 'asc' },
                include: {
                    streams: true,
                },
            });
            return subjects.map((sub) => {
                var _a, _b;
                return ({
                    id: sub.id,
                    name: sub.subjectName,
                    streamName: (_b = (_a = sub.streams[0]) === null || _a === void 0 ? void 0 : _a.streamName) !== null && _b !== void 0 ? _b : '',
                    streams: sub.streams.map(s => ({ id: s.id, name: s.streamName, streamName: s.streamName })),
                    feePerMonth: decimalToNumber(sub.feeAmount),
                });
            });
        });
    }
    static createStream(dto, actor) {
        return __awaiter(this, void 0, void 0, function* () {
            const stream = yield prisma_config_1.default.stream.create({
                data: {
                    streamName: dto.name,
                    batches: dto.batchIds && dto.batchIds.length > 0 ? {
                        connect: dto.batchIds.map(id => ({ id }))
                    } : undefined,
                },
                include: {
                    batches: true,
                },
            });
            if (actor === null || actor === void 0 ? void 0 : actor.userId) {
                yield prisma_config_1.default.auditLog.create({
                    data: {
                        action: client_1.AuditAction.CREATE,
                        userId: actor.userId,
                        module: 'STREAM',
                        description: `Stream created: ${stream.streamName}`,
                    },
                });
            }
            return stream;
        });
    }
    static updateStream(streamId, streamName, batchIds) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_config_1.default.stream.update({
                where: { id: streamId },
                data: {
                    streamName,
                    batches: batchIds ? {
                        set: batchIds.map(id => ({ id }))
                    } : undefined
                },
                include: {
                    batches: true
                }
            });
        });
    }
    static createSubject(dto, actor) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const requestedCode = dto.subjectCode ? dto.subjectCode.toUpperCase() : generateSubjectCode(dto.subjectName);
            const code = yield ensureUniqueSubjectCode(requestedCode);
            // Resolve stream IDs from either streamIds array or single streamId
            const streamIds = ((_a = dto.streamIds) === null || _a === void 0 ? void 0 : _a.length) ? dto.streamIds : (dto.streamId ? [dto.streamId] : []);
            const subject = yield prisma_config_1.default.subject.create({
                data: {
                    subjectName: dto.subjectName,
                    subjectCode: code,
                    feeAmount: new client_1.Prisma.Decimal(dto.feeAmount),
                    isActive: (_b = dto.isActive) !== null && _b !== void 0 ? _b : true,
                    streams: streamIds.length > 0 ? {
                        connect: streamIds.map((id) => ({ id })),
                    } : undefined,
                },
                include: {
                    streams: true,
                    subjectAllocations: {
                        include: {
                            teacher: {
                                include: { user: true },
                            },
                        },
                    },
                },
            });
            if (actor === null || actor === void 0 ? void 0 : actor.userId) {
                yield prisma_config_1.default.auditLog.create({
                    data: {
                        action: client_1.AuditAction.CREATE,
                        userId: actor.userId,
                        module: 'SUBJECT',
                        description: `Subject created: ${subject.subjectName} (${subject.subjectCode})`,
                    },
                });
            }
            return buildSubjectResponse(subject, 0);
        });
    }
    static getSubjects(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const where = {};
            if (params.userRole === client_1.Role.STUDENT && params.active === undefined) {
                where.isActive = true;
            }
            else if (params.active !== undefined) {
                where.isActive = params.active;
            }
            if (params.teacherId) {
                where.subjectAllocations = {
                    some: {
                        teacherId: params.teacherId,
                        status: client_1.SubjectAllocationStatus.ACTIVE,
                    },
                };
            }
            if (params.streamId) {
                where.streams = { some: { id: params.streamId } };
            }
            if (params.search) {
                where.OR = [
                    { subjectName: { contains: params.search, mode: 'insensitive' } },
                    { subjectCode: { contains: params.search, mode: 'insensitive' } },
                ];
            }
            try {
                const [subjects, currentTeacher] = yield Promise.all([
                    prisma_config_1.default.subject.findMany({
                        where,
                        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
                        include: {
                            streams: true,
                            subjectAllocations: {
                                include: {
                                    teacher: {
                                        include: {
                                            user: {
                                                select: {
                                                    isActive: true,
                                                    fullName: true,
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    }),
                    params.userRole === client_1.Role.TEACHER && params.userId ? getTeacherProfileByUserId(params.userId) : Promise.resolve(null),
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
            }
            catch (err) {
                console.error('[getSubjects] Prisma/DB error:', (_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : err);
                throw err;
            }
        });
    }
    static getSubjectByIdentifier(identifier, actor) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const subject = yield findSubjectByIdentifier(identifier);
            if (!subject) {
                throw new AppError_1.AppError('Subject not found.', 404);
            }
            if (!subject.isActive && (actor === null || actor === void 0 ? void 0 : actor.userRole) === client_1.Role.STUDENT) {
                throw new AppError_1.AppError('Subject not found.', 404);
            }
            const activeEnrollmentCount = yield prisma_config_1.default.enrollment.count({
                where: {
                    subjectId: subject.id,
                    enrollmentStatus: client_1.EnrollmentStatus.ACTIVE,
                },
            });
            const currentTeacher = (actor === null || actor === void 0 ? void 0 : actor.userRole) === client_1.Role.TEACHER && actor.userId
                ? yield getTeacherProfileByUserId(actor.userId)
                : null;
            return buildSubjectResponse(subject, activeEnrollmentCount, (_a = currentTeacher === null || currentTeacher === void 0 ? void 0 : currentTeacher.id) !== null && _a !== void 0 ? _a : undefined);
        });
    }
    static updateSubject(subjectId, dto, actor) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const existing = yield prisma_config_1.default.subject.findUnique({
                where: { id: subjectId },
            });
            if (!existing) {
                throw new AppError_1.AppError('Subject not found.', 404);
            }
            const data = {};
            if (dto.subjectName !== undefined) {
                data.subjectName = dto.subjectName;
            }
            if (dto.subjectCode !== undefined) {
                data.subjectCode = dto.subjectCode;
            }
            if (dto.feeAmount !== undefined) {
                data.feeAmount = new client_1.Prisma.Decimal(dto.feeAmount);
            }
            if (dto.isActive !== undefined) {
                data.isActive = dto.isActive;
            }
            if (dto.streamId !== undefined || dto.streamIds !== undefined) {
                // Resolve stream IDs from either streamIds array or single streamId
                const streamIds = ((_a = dto.streamIds) === null || _a === void 0 ? void 0 : _a.length) ? dto.streamIds : (dto.streamId ? [dto.streamId] : []);
                if (streamIds.length > 0) {
                    data.streams = { set: streamIds.map((id) => ({ id })) };
                }
            }
            const updated = yield prisma_config_1.default.subject.update({
                where: { id: subjectId },
                data,
                include: {
                    streams: true,
                    subjectAllocations: {
                        include: {
                            teacher: {
                                include: {
                                    user: {
                                        select: {
                                            isActive: true,
                                            fullName: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });
            if (actor === null || actor === void 0 ? void 0 : actor.userId) {
                yield prisma_config_1.default.auditLog.create({
                    data: {
                        action: client_1.AuditAction.UPDATE,
                        userId: actor.userId,
                        module: 'SUBJECT',
                        description: `Subject updated: ${updated.subjectName}`,
                    },
                });
            }
            return buildSubjectResponse(updated, 0);
        });
    }
    static deactivateSubject(subjectId, actor) {
        return __awaiter(this, void 0, void 0, function* () {
            const subject = yield prisma_config_1.default.subject.findUnique({
                where: { id: subjectId },
            });
            if (!subject) {
                throw new AppError_1.AppError('Subject not found.', 404);
            }
            const activeEnrollmentCount = yield prisma_config_1.default.enrollment.count({
                where: {
                    subjectId,
                    enrollmentStatus: client_1.EnrollmentStatus.ACTIVE,
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
                    streams: true,
                    subjectAllocations: {
                        include: {
                            teacher: {
                                include: {
                                    user: {
                                        select: {
                                            isActive: true,
                                            fullName: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });
            if (actor === null || actor === void 0 ? void 0 : actor.userId) {
                yield prisma_config_1.default.auditLog.create({
                    data: {
                        action: client_1.AuditAction.UPDATE,
                        userId: actor.userId,
                        module: 'SUBJECT',
                        description: `Subject deactivated: ${subjectId}`,
                    },
                });
            }
            return buildSubjectResponse(updated, activeEnrollmentCount);
        });
    }
    static assignTeacher(subjectId, teacherId, batchIds, actor) {
        return __awaiter(this, void 0, void 0, function* () {
            const subject = yield prisma_config_1.default.subject.findUnique({ where: { id: subjectId } });
            if (!subject) {
                throw new AppError_1.AppError('Subject not found.', 404);
            }
            const teacher = yield resolveTeacherReference(teacherId);
            if (!teacher) {
                throw new AppError_1.AppError('Teacher not found.', 404);
            }
            // Allocate teacher using SubjectAllocation
            yield prisma_config_1.default.subjectAllocation.upsert({
                where: {
                    teacherId_subjectId: {
                        teacherId: teacher.id,
                        subjectId,
                    },
                },
                create: Object.assign({ teacherId: teacher.id, subjectId, status: client_1.SubjectAllocationStatus.ACTIVE }, (batchIds && {
                    batches: {
                        connect: batchIds.map((id) => ({ id })),
                    },
                })),
                update: Object.assign({ status: client_1.SubjectAllocationStatus.ACTIVE }, (batchIds && {
                    batches: {
                        set: batchIds.map((id) => ({ id })),
                    },
                })),
            });
            if (actor === null || actor === void 0 ? void 0 : actor.userId) {
                yield prisma_config_1.default.auditLog.create({
                    data: {
                        action: client_1.AuditAction.UPDATE,
                        userId: actor.userId,
                        module: 'SUBJECT',
                        description: `Teacher ${teacher.id} assigned to subject ${subject.subjectName}`,
                    },
                });
            }
            const updatedSubject = yield prisma_config_1.default.subject.findUnique({
                where: { id: subjectId },
                include: {
                    streams: true,
                    subjectAllocations: {
                        include: {
                            teacher: {
                                include: {
                                    user: true,
                                },
                            },
                        },
                    },
                },
            });
            return buildSubjectResponse(updatedSubject, 0);
        });
    }
    static getSubjectTeachers(subjectId) {
        return __awaiter(this, void 0, void 0, function* () {
            const allocations = yield prisma_config_1.default.subjectAllocation.findMany({
                where: { subjectId, status: client_1.SubjectAllocationStatus.ACTIVE },
                include: {
                    teacher: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    fullName: true,
                                    email: true,
                                    phone: true,
                                    isActive: true,
                                    profileImage: true,
                                }
                            }
                        }
                    }
                }
            });
            return allocations.map(a => a.teacher);
        });
    }
    static getSubjectStudents(subjectId, actor) {
        return __awaiter(this, void 0, void 0, function* () {
            const subject = yield prisma_config_1.default.subject.findUnique({
                where: { id: subjectId },
                select: {
                    id: true,
                },
            });
            if (!subject) {
                throw new AppError_1.AppError('Subject not found.', 404);
            }
            if ((actor === null || actor === void 0 ? void 0 : actor.userRole) === client_1.Role.TEACHER && actor.userId) {
                const teacher = yield getTeacherProfileByUserId(actor.userId);
                // Ensure the teacher is allocated to this subject
                const allocation = yield prisma_config_1.default.subjectAllocation.findFirst({
                    where: {
                        subjectId,
                        teacherId: teacher === null || teacher === void 0 ? void 0 : teacher.id,
                        status: client_1.SubjectAllocationStatus.ACTIVE,
                    },
                });
                if (!allocation) {
                    throw new AppError_1.AppError('You can only view students for your assigned subjects.', 403);
                }
            }
            const enrollments = yield prisma_config_1.default.enrollment.findMany({
                where: {
                    subjectId,
                    enrollmentStatus: client_1.EnrollmentStatus.ACTIVE,
                },
                include: {
                    student: {
                        include: {
                            user: {
                                select: {
                                    isActive: true,
                                    email: true,
                                    fullName: true,
                                },
                            },
                        },
                    },
                },
                orderBy: {
                    enrolledDate: 'desc',
                },
            });
            return {
                data: enrollments.map((enrollment) => {
                    var _a, _b, _c;
                    return ({
                        enrollmentId: enrollment.id,
                        studentId: enrollment.studentId,
                        enrolledAt: enrollment.enrolledDate,
                        enrollmentStatus: enrollment.enrollmentStatus,
                        student: {
                            id: enrollment.student.id,
                            userId: enrollment.student.userId,
                            name: ((_a = enrollment.student.user) === null || _a === void 0 ? void 0 : _a.fullName) || '',
                            indexNumber: enrollment.student.indexNumber,
                            phone: enrollment.student.phone,
                            address: enrollment.student.address,
                            isActive: (_c = (_b = enrollment.student.user) === null || _b === void 0 ? void 0 : _b.isActive) !== null && _c !== void 0 ? _c : true,
                        },
                    });
                }),
                total: enrollments.length,
            };
        });
    }
    static enrollStudent(subjectId, dto, actor) {
        return __awaiter(this, void 0, void 0, function* () {
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
                    enrollmentStatus: client_1.EnrollmentStatus.ACTIVE,
                },
            });
            if ((existingEnrollment === null || existingEnrollment === void 0 ? void 0 : existingEnrollment.enrollmentStatus) === client_1.EnrollmentStatus.ACTIVE) {
                throw new AppError_1.AppError('Student is already enrolled in this subject.', 409);
            }
            const enrollment = existingEnrollment
                ? yield prisma_config_1.default.enrollment.update({
                    where: { id: existingEnrollment.id },
                    data: { enrollmentStatus: client_1.EnrollmentStatus.ACTIVE },
                })
                : yield prisma_config_1.default.enrollment.create({
                    data: {
                        studentId,
                        subjectId,
                        enrollmentStatus: client_1.EnrollmentStatus.ACTIVE,
                    },
                });
            if (actor === null || actor === void 0 ? void 0 : actor.userId) {
                yield prisma_config_1.default.auditLog.create({
                    data: {
                        action: client_1.AuditAction.CREATE,
                        userId: actor.userId,
                        module: 'ENROLLMENT',
                        description: `Student ${studentId} enrolled in subject ${subjectId}`,
                    },
                });
            }
            return enrollment;
        });
    }
    static unenrollStudent(subjectId, studentId, actor) {
        return __awaiter(this, void 0, void 0, function* () {
            const subject = yield prisma_config_1.default.subject.findUnique({
                where: { id: subjectId },
                select: {
                    id: true,
                },
            });
            if (!subject) {
                throw new AppError_1.AppError('Subject not found.', 404);
            }
            if ((actor === null || actor === void 0 ? void 0 : actor.userRole) === client_1.Role.STUDENT) {
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
                    enrollmentStatus: client_1.EnrollmentStatus.ACTIVE,
                },
            });
            if (!enrollment || enrollment.enrollmentStatus !== client_1.EnrollmentStatus.ACTIVE) {
                throw new AppError_1.AppError('Active enrollment not found.', 404);
            }
            const updated = yield prisma_config_1.default.enrollment.update({
                where: { id: enrollment.id },
                data: { enrollmentStatus: client_1.EnrollmentStatus.DROPPED },
            });
            if (actor === null || actor === void 0 ? void 0 : actor.userId) {
                yield prisma_config_1.default.auditLog.create({
                    data: {
                        action: client_1.AuditAction.UPDATE,
                        userId: actor.userId,
                        module: 'ENROLLMENT',
                        description: `Student ${studentId} unenrolled from subject ${subjectId}`,
                    },
                });
            }
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
                    enrollmentStatus: client_1.EnrollmentStatus.ACTIVE,
                },
            });
        });
    }
}
exports.SubjectsService = SubjectsService;
exports.default = SubjectsService;
