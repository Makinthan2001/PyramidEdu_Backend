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
exports.getTeachers = getTeachers;
exports.getTeacherById = getTeacherById;
exports.createTeacher = createTeacher;
exports.updateTeacher = updateTeacher;
exports.deleteTeacher = deleteTeacher;
exports.getMyProfile = getMyProfile;
exports.updateMyProfile = updateMyProfile;
exports.getTeacherSubjects = getTeacherSubjects;
exports.updateSalary = updateSalary;
exports.assignSubject = assignSubject;
exports.getMyDashboardData = getMyDashboardData;
const teachers_service_1 = __importDefault(require("../service/teachers.service"));
/**
 * GET /api/v1/teachers
 * List teachers with pagination and optional filters
 */
function getTeachers(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const search = req.query.search;
            const result = yield teachers_service_1.default.getTeachers({ page, limit, search });
            res.status(200).json({ success: true, message: 'Teachers retrieved', data: result });
        }
        catch (error) {
            next(error);
        }
    });
}
/**
 * GET /api/v1/teachers/:id
 * Retrieve a single teacher by ID
 */
function getTeacherById(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const id = req.params.id;
            const teacher = yield teachers_service_1.default.getTeacherById(id);
            if (!teacher) {
                return res.status(404).json({ success: false, message: 'Teacher not found' });
            }
            res.status(200).json({ success: true, message: 'Teacher retrieved', data: teacher });
        }
        catch (error) {
            next(error);
        }
    });
}
/**
 * POST /api/v1/teachers
 * Create a new teacher profile (admin only)
 */
function createTeacher(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const dto = req.body;
            const teacher = yield teachers_service_1.default.createTeacher(dto);
            res.status(201).json({ success: true, message: 'Teacher created', data: teacher });
        }
        catch (error) {
            next(error);
        }
    });
}
/**
 * PATCH /api/v1/teachers/:id
 * Update teacher details (admin/manager)
 */
function updateTeacher(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const id = req.params.id;
            const dto = req.body;
            const teacher = yield teachers_service_1.default.updateTeacher(id, dto);
            res.status(200).json({ success: true, message: 'Teacher updated', data: teacher });
        }
        catch (error) {
            next(error);
        }
    });
}
/**
 * DELETE /api/v1/teachers/:id
 * Soft‑delete teacher (admin only)
 */
function deleteTeacher(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const id = req.params.id;
            const teacher = yield teachers_service_1.default.deleteTeacher(id);
            res.status(200).json({ success: true, message: 'Teacher deleted (soft)', data: teacher });
        }
        catch (error) {
            next(error);
        }
    });
}
/**
 * GET /api/v1/teachers/me
 * Return the logged‑in teacher's own profile
 */
function getMyProfile(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userId = req.userId;
            const teacher = yield teachers_service_1.default.getTeacherByUserId(userId);
            if (!teacher) {
                return res.status(404).json({ success: false, message: 'Teacher profile not found' });
            }
            res.status(200).json({ success: true, message: 'Profile retrieved', data: teacher });
        }
        catch (error) {
            next(error);
        }
    });
}
/**
 * PATCH /api/v1/teachers/me
 * Update basic own details (teacher role)
 */
function updateMyProfile(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userId = req.userId;
            const teacher = yield teachers_service_1.default.getTeacherByUserId(userId);
            if (!teacher) {
                return res.status(404).json({ success: false, message: 'Teacher profile not found' });
            }
            const dto = req.body;
            const updatedTeacher = yield teachers_service_1.default.updateTeacher(teacher.id, dto);
            res.status(200).json({ success: true, message: 'Profile updated', data: updatedTeacher });
        }
        catch (error) {
            next(error);
        }
    });
}
/**
 * GET /api/v1/teachers/:id/subjects
 * List subjects assigned to a teacher
 */
function getTeacherSubjects(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            const id = req.params.id;
            const teacher = yield teachers_service_1.default.getTeacherById(id);
            if (!teacher) {
                return res.status(404).json({ success: false, message: 'Teacher not found' });
            }
            const subjects = (_b = (_a = teacher.subjectAllocations) === null || _a === void 0 ? void 0 : _a.map((alloc) => alloc.subject)) !== null && _b !== void 0 ? _b : [];
            res.status(200).json({ success: true, message: 'Subjects retrieved', data: subjects });
        }
        catch (error) {
            next(error);
        }
    });
}
/**
 * PATCH /api/v1/teachers/:id/salary
 * Update teacher salary (admin only)
 */
function updateSalary(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const id = req.params.id;
            const { salary } = req.body;
            const teacher = yield teachers_service_1.default.updateTeacher(id, { salary });
            res.status(200).json({ success: true, message: 'Salary updated', data: teacher });
        }
        catch (error) {
            next(error);
        }
    });
}
/**
 * PATCH /api/v1/teachers/:id/subjects
 * Assign a subject to a teacher
 */
function assignSubject(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const id = req.params.id;
            const dto = req.body;
            yield teachers_service_1.default.assignSubject(id, dto);
            res.status(200).json({ success: true, message: 'Subject assigned' });
        }
        catch (error) {
            next(error);
        }
    });
}
/**
 * GET /api/v1/teachers/me/dashboard
 * Retrieve dashboard statistics and data for the logged-in teacher
 */
function getMyDashboardData(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userId = req.userId;
            const dashboardData = yield teachers_service_1.default.getMyDashboardData(userId);
            res.status(200).json({ success: true, message: 'Dashboard data retrieved', data: dashboardData });
        }
        catch (error) {
            next(error);
        }
    });
}
exports.default = {
    getTeachers,
    getTeacherById,
    createTeacher,
    updateTeacher,
    deleteTeacher,
    getMyProfile,
    updateMyProfile,
    getTeacherSubjects,
    updateSalary,
    assignSubject,
    getMyDashboardData,
};
