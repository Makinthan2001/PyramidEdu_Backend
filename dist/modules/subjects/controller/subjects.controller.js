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
exports.getSubjects = getSubjects;
exports.getStreams = getStreams;
exports.getAvailableSubjects = getAvailableSubjects;
exports.getTeachersForSubject = getTeachersForSubject;
exports.createStream = createStream;
exports.getSubjectById = getSubjectById;
exports.createSubject = createSubject;
exports.updateSubject = updateSubject;
exports.deactivateSubject = deactivateSubject;
exports.assignTeacher = assignTeacher;
exports.getSubjectStudents = getSubjectStudents;
exports.enrollStudent = enrollStudent;
exports.unenrollStudent = unenrollStudent;
exports.getEnrollmentCount = getEnrollmentCount;
const client_1 = require("@prisma/client");
const subjects_service_1 = __importDefault(require("../service/subjects.service"));
function parseBoolean(value) {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    if (value === 'true' || value === true) {
        return true;
    }
    if (value === 'false' || value === false) {
        return false;
    }
    return undefined;
}
function getSubjects(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userRole = req.userRole;
            const userId = req.userId;
            const result = yield subjects_service_1.default.getSubjects({
                active: parseBoolean(req.query.active),
                teacherId: req.query.teacherId ? Number(req.query.teacherId) : undefined,
                streamId: req.query.streamId ? Number(req.query.streamId) : undefined,
                search: req.query.search || undefined,
                userRole,
                userId,
            });
            res.status(200).json({
                success: true,
                message: 'Subjects retrieved successfully',
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    });
}
function getStreams(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const streams = yield subjects_service_1.default.getStreams();
            res.status(200).json({
                success: true,
                message: 'Streams retrieved successfully',
                data: streams,
            });
        }
        catch (error) {
            next(error);
        }
    });
}
function getAvailableSubjects(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const subjects = yield subjects_service_1.default.getAvailableSubjects();
            res.status(200).json({
                success: true,
                message: 'Available subjects retrieved successfully',
                data: subjects,
            });
        }
        catch (error) {
            next(error);
        }
    });
}
function getTeachersForSubject(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const subjectId = Number(req.query.subjectId);
            if (!Number.isFinite(subjectId)) {
                res.status(400).json({
                    success: false,
                    message: 'subjectId query parameter is required',
                });
                return;
            }
            const teachers = yield subjects_service_1.default.getSubjectTeachers(subjectId);
            res.status(200).json({
                success: true,
                message: 'Teachers retrieved successfully',
                data: teachers,
            });
        }
        catch (error) {
            next(error);
        }
    });
}
function createStream(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const dto = req.body;
            const userId = req.userId;
            const stream = yield subjects_service_1.default.createStream(dto, { userId });
            res.status(201).json({
                success: true,
                message: 'Stream created successfully',
                data: stream,
            });
        }
        catch (error) {
            next(error);
        }
    });
}
function getSubjectById(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const identifier = String(req.params.id);
            const userRole = req.userRole;
            const userId = req.userId;
            const subject = yield subjects_service_1.default.getSubjectByIdentifier(identifier, {
                userRole,
                userId,
            });
            res.status(200).json({
                success: true,
                message: 'Subject retrieved successfully',
                data: subject,
            });
        }
        catch (error) {
            next(error);
        }
    });
}
function createSubject(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const dto = req.body;
            const userId = req.userId;
            const subject = yield subjects_service_1.default.createSubject(dto, { userId });
            res.status(201).json({
                success: true,
                message: 'Subject created successfully',
                data: subject,
            });
        }
        catch (error) {
            next(error);
        }
    });
}
function updateSubject(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const subjectId = Number(req.params.id);
            const dto = req.body;
            const userId = req.userId;
            const subject = yield subjects_service_1.default.updateSubject(subjectId, dto, { userId });
            res.status(200).json({
                success: true,
                message: 'Subject updated successfully',
                data: subject,
            });
        }
        catch (error) {
            next(error);
        }
    });
}
function deactivateSubject(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const subjectId = Number(req.params.id);
            const userId = req.userId;
            const userRole = req.userRole;
            const force = userRole === client_1.UserRole.ADMIN && parseBoolean(req.query.force) === true;
            const subject = yield subjects_service_1.default.deactivateSubject(subjectId, {
                userId,
                force,
            });
            res.status(200).json({
                success: true,
                message: 'Subject deactivated successfully',
                data: subject,
            });
        }
        catch (error) {
            next(error);
        }
    });
}
function assignTeacher(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const rawId = req.params.id;
            const subjectIdentifier = Array.isArray(rawId) ? rawId[0] : rawId; // normalize to string
            const teacherId = Number(Array.isArray(req.body.teacherId) ? req.body.teacherId[0] : req.body.teacherId);
            const userId = req.userId;
            const subject = yield subjects_service_1.default.assignTeacher(subjectIdentifier, teacherId, { userId });
            res.status(200).json({
                success: true,
                message: 'Teacher assigned successfully',
                data: subject,
            });
        }
        catch (error) {
            next(error);
        }
    });
}
function getSubjectStudents(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const subjectId = Number(req.params.id);
            const userRole = req.userRole;
            const userId = req.userId;
            const result = yield subjects_service_1.default.getSubjectStudents(subjectId, {
                userRole,
                userId,
            });
            res.status(200).json({
                success: true,
                message: 'Subject students retrieved successfully',
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    });
}
function enrollStudent(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const subjectId = Number(req.params.id);
            const dto = req.body;
            const userRole = req.userRole;
            const userId = req.userId;
            const enrollment = yield subjects_service_1.default.enrollStudent(subjectId, dto, {
                userRole,
                userId,
            });
            res.status(201).json({
                success: true,
                message: 'Student enrolled successfully',
                data: enrollment,
            });
        }
        catch (error) {
            next(error);
        }
    });
}
function unenrollStudent(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const subjectId = Number(req.params.id);
            const studentId = Number(req.params.sid);
            const userRole = req.userRole;
            const userId = req.userId;
            const enrollment = yield subjects_service_1.default.unenrollStudent(subjectId, studentId, {
                userRole,
                userId,
            });
            res.status(200).json({
                success: true,
                message: 'Student unenrolled successfully',
                data: enrollment,
            });
        }
        catch (error) {
            next(error);
        }
    });
}
function getEnrollmentCount(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const subjectId = Number(req.params.id);
            const count = yield subjects_service_1.default.getEnrollmentCount(subjectId);
            res.status(200).json({
                success: true,
                message: 'Enrollment count retrieved successfully',
                data: { subjectId, enrollmentCount: count },
            });
        }
        catch (error) {
            next(error);
        }
    });
}
exports.default = {
    getAvailableSubjects,
    getStreams,
    createStream,
    getSubjects,
    getSubjectById,
    createSubject,
    updateSubject,
    deactivateSubject,
    assignTeacher,
    getSubjectStudents,
    enrollStudent,
    unenrollStudent,
    getEnrollmentCount,
};
