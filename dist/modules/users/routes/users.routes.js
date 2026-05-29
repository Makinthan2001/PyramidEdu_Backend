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
const jwt_guard_1 = require("../../../modules/auth/guards/jwt.guard");
const validate_1 = require("../../../middleware/validate");
const controller = __importStar(require("../controller/users.controller"));
const users_guard_1 = require("../guards/users.guard");
const users_validator_1 = require("../validators/users.validator");
const change_password_dto_1 = require("../dto/change-password.dto");
const router = (0, express_1.Router)();
/**
 * All routes require JWT authentication
 */
router.use(jwt_guard_1.jwtGuard);
/**
 * GET /api/v1/users
 * List all users (role-based filtering)
 */
router.get('/', users_guard_1.canManageUsers, controller.getUsers);
/**
 * GET /api/v1/users/:id
 * Get specific user by ID (with access control)
 */
router.get('/:id', users_guard_1.canAccessUser, controller.getUserById);
/**
 * POST /api/v1/users
 * Create new user account
 * Role-based schema validation based on role in request
 */
router.post('/', users_guard_1.canManageUsers, (req, res, next) => {
    // Dynamic validation based on role
    const role = req.body.role;
    let schema;
    switch (role) {
        case 'MANAGER':
            schema = users_validator_1.createManagerSchema;
            break;
        case 'TEACHER':
            schema = users_validator_1.createTeacherSchema;
            break;
        case 'STUDENT':
            schema = users_validator_1.createStudentSchema;
            break;
        case 'SUPPORT_STAFF':
            schema = users_validator_1.createSupportStaffSchema;
            break;
        case 'ADMIN':
            schema = users_validator_1.createAdminSchema;
            break;
        default:
            return res.status(400).json({
                success: false,
                message: 'Invalid role specified',
            });
    }
    // Validate with selected schema
    (0, validate_1.validate)(schema)(req, res, next);
}, users_guard_1.canCreateRole, controller.createUser);
/**
 * PATCH /api/v1/users/change-password
 * Change password for current authenticated user
 */
router.patch('/change-password', (0, validate_1.validate)(change_password_dto_1.changePasswordSchema), jwt_guard_1.jwtGuard, controller.changeMyPassword);
/**
 * PATCH /api/v1/users/:id/reset-password
 * Admin resets a user's password and receives a temporary password
 */
router.patch('/:id/reset-password', users_guard_1.canManageUsers, controller.resetUserPassword);
/**
 * PATCH /api/v1/users/:id
 * Update user details
 */
router.patch('/:id', (0, validate_1.validate)(users_validator_1.updateUserSchema), users_guard_1.canAccessUser, controller.updateUser);
/**
 * DELETE /api/v1/users/:id
 * Soft-delete user account (deactivate)
 */
router.delete('/:id', users_guard_1.canManageUsers, controller.deleteUser);
/**
 * PATCH /api/v1/users/:id/deactivate
 * Deactivate user account
 */
router.patch('/:id/deactivate', users_guard_1.canManageUsers, users_guard_1.preventSelfDeactivation, controller.deactivateUser);
/**
 * PATCH /api/v1/users/:id/activate
 * Reactivate user account
 */
router.patch('/:id/activate', users_guard_1.canManageUsers, controller.activateUser);
/**
 * PATCH /api/v1/users/:id/approve
 * Approve a student profile (MANAGER/ADMIN)
 */
router.patch('/:id/approve', users_guard_1.canManageUsers, controller.approveStudent);
exports.default = router;
