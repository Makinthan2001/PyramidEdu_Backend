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
            const teacher = yield prisma_config_1.default.teacher.findFirst({
                where: { id, deletedAt: null },
                include: {
                    user: true,
                    subjectAllocations: {
                        include: {
                            subject: true,
                            batches: true,
                        },
                    },
                },
            });
            if (teacher && teacher.subjectId) {
                const primarySubject = yield prisma_config_1.default.subject.findUnique({
                    where: { id: teacher.subjectId }
                });
                return Object.assign(Object.assign({}, teacher), { primarySubject });
            }
            return teacher;
        });
    }
    static getTeacherByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const teacher = yield prisma_config_1.default.teacher.findFirst({
                where: { userId, deletedAt: null },
                include: {
                    user: true,
                    subjectAllocations: {
                        include: {
                            subject: true,
                            batches: true,
                        },
                    },
                },
            });
            if (teacher && teacher.subjectId) {
                const primarySubject = yield prisma_config_1.default.subject.findUnique({
                    where: { id: teacher.subjectId }
                });
                return Object.assign(Object.assign({}, teacher), { primarySubject });
            }
            return teacher;
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
    static getMyDashboardData(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const teacher = yield prisma_config_1.default.teacher.findFirst({
                where: { userId, deletedAt: null },
                include: {
                    subjectAllocations: {
                        where: { status: 'ACTIVE' },
                        include: {
                            batches: true,
                        },
                    },
                },
            });
            if (!teacher) {
                throw new AppError_1.AppError('Teacher profile not found.', 404);
            }
            const orConditions = [];
            // 1. Direct assignment via active enrollment.teacherId
            orConditions.push({
                enrollments: {
                    some: {
                        teacherId: teacher.id,
                        enrollmentStatus: 'ACTIVE',
                    },
                },
            });
            // 2. Allocation relationship (teacher -> subject -> batch -> enrollment/student)
            for (const alloc of teacher.subjectAllocations) {
                const batchIds = alloc.batches.map((b) => b.id);
                if (batchIds.length > 0) {
                    orConditions.push({
                        batchId: { in: batchIds },
                        enrollments: {
                            some: {
                                subjectId: alloc.subjectId,
                                enrollmentStatus: 'ACTIVE',
                            },
                        },
                    });
                }
            }
            if (orConditions.length === 0) {
                return {
                    summaryCards: {
                        totalStudents: 0,
                        todayAttendance: { present: 0, absent: 0 },
                        activeQuiz: 'No Active Quiz',
                        classAverage: 0,
                    },
                    classPerformance: [],
                    recentActivities: [],
                    todaySchedule: [],
                    atRiskStudents: [],
                };
            }
            const assignedStudentsWhere = {
                deletedAt: null,
                approvalStatus: 'APPROVED',
                OR: orConditions,
            };
            // Card 1: Total Students
            const totalStudents = yield prisma_config_1.default.student.count({
                where: assignedStudentsWhere,
            });
            // Card 2: Today's Attendance
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);
            const todayAttendances = yield prisma_config_1.default.attendance.findMany({
                where: {
                    OR: [
                        { teacherId: teacher.id },
                        { student: assignedStudentsWhere },
                    ],
                    attendanceDate: {
                        gte: todayStart,
                        lte: todayEnd,
                    },
                },
                select: {
                    attendanceStatus: true,
                },
            });
            let present = 0;
            let absent = 0;
            for (const att of todayAttendances) {
                if (att.attendanceStatus === 'PRESENT' || att.attendanceStatus === 'LATE') {
                    present++;
                }
                else {
                    absent++;
                }
            }
            // Card 3: Active Quiz
            const latestQuiz = yield prisma_config_1.default.quiz.findFirst({
                where: {
                    teacherId: teacher.id,
                    deletedAt: null,
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });
            const activeQuiz = latestQuiz ? latestQuiz.quizTitle : 'No Active Quiz';
            // Card 4: Overall Class Average (Marks recorded by this teacher)
            const averageMarksAgg = yield prisma_config_1.default.result.aggregate({
                where: {
                    teacherId: teacher.id,
                },
                _avg: {
                    marks: true,
                },
            });
            const classAverage = averageMarksAgg._avg.marks ? Math.round(Number(averageMarksAgg._avg.marks)) : 0;
            // Class Performance chart
            const uniqueBatches = Array.from(new Map(teacher.subjectAllocations.flatMap((sa) => sa.batches).map((b) => [b.id, b])).values());
            const batchIds = uniqueBatches.map((b) => b.id);
            const classPerformance = [];
            if (batchIds.length > 0) {
                const studentsInBatches = yield prisma_config_1.default.student.findMany({
                    where: {
                        batchId: { in: batchIds },
                        deletedAt: null,
                        approvalStatus: 'APPROVED',
                    },
                    select: {
                        id: true,
                        batchId: true,
                        attendancePercentage: true,
                    },
                });
                const studentIdsByBatch = new Map();
                const attendanceSumByBatch = new Map();
                for (const s of studentsInBatches) {
                    if (s.batchId) {
                        if (!studentIdsByBatch.has(s.batchId)) {
                            studentIdsByBatch.set(s.batchId, []);
                        }
                        studentIdsByBatch.get(s.batchId).push(s.id);
                        if (!attendanceSumByBatch.has(s.batchId)) {
                            attendanceSumByBatch.set(s.batchId, { sum: 0, count: 0 });
                        }
                        const val = attendanceSumByBatch.get(s.batchId);
                        val.sum += Number(s.attendancePercentage);
                        val.count += 1;
                    }
                }
                const allStudentIds = studentsInBatches.map((s) => s.id);
                const results = yield prisma_config_1.default.result.findMany({
                    where: {
                        teacherId: teacher.id,
                        studentId: { in: allStudentIds },
                    },
                    select: {
                        studentId: true,
                        marks: true,
                    },
                });
                const marksByStudent = new Map();
                for (const r of results) {
                    if (!marksByStudent.has(r.studentId)) {
                        marksByStudent.set(r.studentId, []);
                    }
                    marksByStudent.get(r.studentId).push(Number(r.marks));
                }
                for (const b of uniqueBatches) {
                    const sIds = studentIdsByBatch.get(b.id) || [];
                    let batchMarksSum = 0;
                    let batchMarksCount = 0;
                    for (const sId of sIds) {
                        const studentMarks = marksByStudent.get(sId) || [];
                        for (const m of studentMarks) {
                            batchMarksSum += m;
                            batchMarksCount++;
                        }
                    }
                    const avgMarks = batchMarksCount > 0 ? Math.round(batchMarksSum / batchMarksCount) : 0;
                    const attVal = attendanceSumByBatch.get(b.id);
                    const avgAttendance = attVal && attVal.count > 0 ? Math.round(attVal.sum / attVal.count) : 0;
                    classPerformance.push({
                        c: b.batchName,
                        marks: avgMarks,
                        attendance: avgAttendance,
                    });
                }
            }
            // Recent Student Activities (latest 5)
            const assignedStudents = yield prisma_config_1.default.student.findMany({
                where: assignedStudentsWhere,
                select: {
                    id: true,
                    user: {
                        select: {
                            fullName: true,
                        },
                    },
                },
            });
            const studentIds = assignedStudents.map((s) => s.id);
            const studentNameMap = new Map(assignedStudents.map((s) => [s.id, s.user.fullName]));
            const recentActivities = [];
            if (studentIds.length > 0) {
                const [assignmentSubmissions, examSubmissions, absentAttendances] = yield Promise.all([
                    prisma_config_1.default.assignmentSubmission.findMany({
                        where: {
                            studentId: { in: studentIds },
                        },
                        include: {
                            assignment: { select: { title: true } },
                        },
                        orderBy: { submittedAt: 'desc' },
                        take: 10,
                    }),
                    prisma_config_1.default.examSubmission.findMany({
                        where: {
                            studentId: { in: studentIds },
                        },
                        include: {
                            exam: { select: { examTitle: true } },
                        },
                        orderBy: { submittedAt: 'desc' },
                        take: 10,
                    }),
                    prisma_config_1.default.attendance.findMany({
                        where: {
                            studentId: { in: studentIds },
                            attendanceStatus: 'ABSENT',
                        },
                        orderBy: { attendanceDate: 'desc' },
                        take: 10,
                    }),
                ]);
                for (const sub of assignmentSubmissions) {
                    const sName = studentNameMap.get(sub.studentId) || 'Student';
                    recentActivities.push({
                        name: sName,
                        action: `Submitted assignment: ${sub.assignment.title}`,
                        time: sub.submittedAt.toISOString(),
                        timestamp: sub.submittedAt,
                    });
                }
                for (const sub of examSubmissions) {
                    const sName = studentNameMap.get(sub.studentId) || 'Student';
                    recentActivities.push({
                        name: sName,
                        action: `Completed exam: ${sub.exam.examTitle}`,
                        time: sub.submittedAt.toISOString(),
                        timestamp: sub.submittedAt,
                    });
                }
                for (const att of absentAttendances) {
                    const sName = studentNameMap.get(att.studentId) || 'Student';
                    recentActivities.push({
                        name: sName,
                        action: `Marked absent`,
                        time: att.attendanceDate.toISOString(),
                        timestamp: att.attendanceDate,
                    });
                }
                recentActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            }
            // Today's Schedule (max 4)
            const classSessions = yield prisma_config_1.default.classSession.findMany({
                where: {
                    teacherId: teacher.id,
                    sessionDate: {
                        gte: todayStart,
                        lte: todayEnd,
                    },
                },
                include: {
                    batch: true,
                },
                orderBy: {
                    sessionTime: 'asc',
                },
                take: 4,
            });
            const todaySchedule = classSessions.map((cs) => {
                var _a;
                return ({
                    time: cs.sessionTime,
                    grade: ((_a = cs.batch) === null || _a === void 0 ? void 0 : _a.batchName) || 'Unknown Grade',
                });
            });
            // AI Alerts / At Risk Students (max 3, but fetch all for view all)
            const atRiskStudentsData = yield prisma_config_1.default.student.findMany({
                where: {
                    deletedAt: null,
                    approvalStatus: 'APPROVED',
                    OR: orConditions,
                    AND: [
                        {
                            OR: [
                                { attendancePercentage: { lt: 75 } },
                                { trendStatus: 'DECLINING' },
                                { performanceStatus: 'AT_RISK' },
                            ],
                        },
                    ],
                },
                include: {
                    user: {
                        select: {
                            fullName: true,
                        },
                    },
                },
            });
            const atRiskStudents = atRiskStudentsData.map((student) => {
                let reason = 'Predicted At Risk';
                if (Number(student.attendancePercentage) < 75) {
                    reason = 'Attendance below 75%';
                }
                else if (student.trendStatus === 'DECLINING') {
                    reason = 'Performance Declining';
                }
                else if (student.performanceStatus === 'AT_RISK') {
                    reason = 'Predicted At Risk';
                }
                return {
                    studentName: student.user.fullName,
                    reason,
                };
            });
            return {
                summaryCards: {
                    totalStudents,
                    todayAttendance: {
                        present,
                        absent,
                    },
                    activeQuiz,
                    classAverage,
                },
                classPerformance,
                recentActivities: recentActivities.slice(0, 20).map(a => ({
                    name: a.name,
                    action: a.action,
                    time: a.time,
                })),
                todaySchedule,
                atRiskStudents,
            };
        });
    }
}
exports.TeachersService = TeachersService;
exports.default = TeachersService;
