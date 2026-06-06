"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const jwt_guard_1 = require("../../../modules/auth/guards/jwt.guard");
const role_guard_1 = require("../../../modules/auth/guards/role.guard");
const validate_1 = require("../../../middleware/validate");
const controller = __importStar(require("../controller/teachers.controller"));
const teachers_validator_1 = require("../validators/teachers.validator");
const router = (0, express_1.Router)();
// Protected routes
router.use(jwt_guard_1.jwtGuard);
// ADMIN & MANAGER can list all teachers
router.get('/', (0, role_guard_1.roleGuard)(client_1.Role.ADMIN, client_1.Role.MANAGER), controller.getTeachers);
// Get teacher by ID – ADMIN, MANAGER, or the teacher themselves
router.get('/:id', (0, role_guard_1.roleGuard)(client_1.Role.ADMIN, client_1.Role.MANAGER, client_1.Role.TEACHER), controller.getTeacherById);
// Create teacher – ADMIN only
router.post('/', (0, role_guard_1.roleGuard)(client_1.Role.ADMIN), (0, validate_1.validate)(teachers_validator_1.teachersValidator.createTeacherSchema), controller.createTeacher);
// Update teacher – ADMIN or MANAGER
router.patch('/:id', (0, role_guard_1.roleGuard)(client_1.Role.ADMIN, client_1.Role.MANAGER), (0, validate_1.validate)(teachers_validator_1.teachersValidator.updateTeacherSchema), controller.updateTeacher);
// Delete (soft) teacher – ADMIN only
router.delete('/:id', (0, role_guard_1.roleGuard)(client_1.Role.ADMIN), controller.deleteTeacher);
// Self‑service routes for the logged‑in teacher
router.get('/me', (0, role_guard_1.roleGuard)(client_1.Role.TEACHER), controller.getMyProfile);
router.patch('/me', (0, role_guard_1.roleGuard)(client_1.Role.TEACHER), (0, validate_1.validate)(teachers_validator_1.teachersValidator.updateTeacherSchema), controller.updateMyProfile);
// Teacher's subjects list – ADMIN, MANAGER, TEACHER (own)
router.get('/:id/subjects', (0, role_guard_1.roleGuard)(client_1.Role.ADMIN, client_1.Role.MANAGER, client_1.Role.TEACHER), controller.getTeacherSubjects);
// Salary update – ADMIN only
router.patch('/:id/salary', (0, role_guard_1.roleGuard)(client_1.Role.ADMIN), controller.updateSalary);
// Assign subject – ADMIN or MANAGER
router.patch('/:id/subjects', (0, role_guard_1.roleGuard)(client_1.Role.ADMIN, client_1.Role.MANAGER), (0, validate_1.validate)(teachers_validator_1.teachersValidator.assignSubjectSchema), controller.assignSubject);
exports.default = router;
