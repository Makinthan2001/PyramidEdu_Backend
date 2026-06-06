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
const controller = __importStar(require("../controller/subjects.controller"));
const subjects_validator_1 = require("../validators/subjects.validator");
const router = (0, express_1.Router)();
// Public read-only endpoints for the student registration flow.
router.get('/streams', controller.getStreams);
router.get('/available', controller.getAvailableSubjects);
router.get('/teachers', controller.getTeachersForSubject);
router.use(jwt_guard_1.jwtGuard);
router.post('/streams', (0, role_guard_1.roleGuard)(client_1.Role.ADMIN, client_1.Role.MANAGER), (0, validate_1.validate)(subjects_validator_1.createStreamSchema), controller.createStream);
router.get('/', controller.getSubjects);
router.get('/:id', controller.getSubjectById);
router.post('/', (0, role_guard_1.roleGuard)(client_1.Role.ADMIN, client_1.Role.MANAGER), (0, validate_1.validate)(subjects_validator_1.createSubjectSchema), controller.createSubject);
router.patch('/:id', (0, role_guard_1.roleGuard)(client_1.Role.ADMIN, client_1.Role.MANAGER), (0, validate_1.validate)(subjects_validator_1.updateSubjectSchema), controller.updateSubject);
router.delete('/:id', (0, role_guard_1.roleGuard)(client_1.Role.ADMIN, client_1.Role.MANAGER), controller.deactivateSubject);
router.patch('/:id/assign-teacher', (0, role_guard_1.roleGuard)(client_1.Role.ADMIN, client_1.Role.MANAGER), (0, validate_1.validate)(subjects_validator_1.assignTeacherSchema), controller.assignTeacher);
router.get('/:id/students', (0, role_guard_1.roleGuard)(client_1.Role.ADMIN, client_1.Role.MANAGER, client_1.Role.TEACHER), controller.getSubjectStudents);
router.post('/:id/enroll', (0, role_guard_1.roleGuard)(client_1.Role.ADMIN, client_1.Role.MANAGER, client_1.Role.STUDENT), (0, validate_1.validate)(subjects_validator_1.enrollStudentSchema), controller.enrollStudent);
router.delete('/:id/unenroll/:sid', (0, role_guard_1.roleGuard)(client_1.Role.ADMIN, client_1.Role.MANAGER, client_1.Role.STUDENT), controller.unenrollStudent);
router.get('/:id/enrollmentcount', (0, role_guard_1.roleGuard)(client_1.Role.ADMIN, client_1.Role.MANAGER, client_1.Role.TEACHER), controller.getEnrollmentCount);
router.get('/:id/enrollment-count', (0, role_guard_1.roleGuard)(client_1.Role.ADMIN, client_1.Role.MANAGER, client_1.Role.TEACHER), controller.getEnrollmentCount);
exports.default = router;
