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
exports.getUsers = getUsers;
exports.getUserById = getUserById;
exports.createUser = createUser;
exports.changeMyPassword = changeMyPassword;
exports.resetUserPassword = resetUserPassword;
exports.updateUser = updateUser;
exports.deleteUser = deleteUser;
exports.deactivateUser = deactivateUser;
exports.activateUser = activateUser;
exports.approveStudent = approveStudent;
const users_service_1 = __importDefault(require("../service/users.service"));
/**
 * Users Controller - Handles user account operations
 */
/**
 * GET /api/v1/users
 * List all users with role-based filtering and pagination
 */
function getUsers(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const search = req.query.search;
            const role = req.query.role;
            const status = req.query.status;
            const userRole = req.userRole;
            const result = yield users_service_1.default.getUsers({
                page,
                limit,
                search,
                role: role,
                status: status,
                userRole,
            });
            res.status(200).json({
                success: true,
                message: 'Users retrieved successfully',
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    });
}
/**
 * GET /api/v1/users/:id
 * Get user by ID
 */
function getUserById(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userId = parseInt(req.params.id);
            const user = yield users_service_1.default.getUserById(userId);
            res.status(200).json({
                success: true,
                message: 'User retrieved successfully',
                data: user,
            });
        }
        catch (error) {
            next(error);
        }
    });
}
/**
 * POST /api/v1/users
 * Create new user account
 */
function createUser(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            const dto = req.body;
            const role = dto.role;
            const result = yield users_service_1.default.createUser(dto, role);
            res.status(201).json({
                success: true,
                message: 'User created successfully',
                data: (_a = result.user) !== null && _a !== void 0 ? _a : result,
                temporaryPassword: (_b = result.temporaryPassword) !== null && _b !== void 0 ? _b : undefined,
            });
        }
        catch (error) {
            next(error);
        }
    });
}
/**
 * PATCH /api/v1/users/change-password
 * Change password for current user
 */
function changeMyPassword(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userId = req.userId;
            const dto = req.body;
            yield users_service_1.default.changePassword(userId, dto.oldPassword, dto.newPassword);
            res.status(200).json({
                success: true,
                message: 'Password changed successfully',
            });
        }
        catch (error) {
            next(error);
        }
    });
}
/**
 * PATCH /api/v1/users/:id/reset-password
 * Admin resets a user's password; server returns a temporary password
 */
function resetUserPassword(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const targetUserId = parseInt(req.params.id);
            // Allow admins to provide a specific password in the request body to set for the user.
            const providedPassword = (req.body && typeof req.body.password === 'string' && req.body.password.length > 0)
                ? req.body.password
                : undefined;
            let result;
            if (providedPassword) {
                result = yield users_service_1.default.setPasswordForUser(targetUserId, providedPassword);
            }
            else {
                result = yield users_service_1.default.resetPassword(targetUserId);
            }
            res.status(200).json({
                success: true,
                message: 'Password reset successfully',
                data: result.user,
                temporaryPassword: result.temporaryPassword,
            });
        }
        catch (error) {
            next(error);
        }
    });
}
/**
 * PATCH /api/v1/users/:id
 * Update user details
 */
function updateUser(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userId = parseInt(req.params.id);
            const dto = req.body;
            const user = yield users_service_1.default.updateUser(userId, dto);
            res.status(200).json({
                success: true,
                message: 'User updated successfully',
                data: user,
            });
        }
        catch (error) {
            next(error);
        }
    });
}
/**
 * DELETE /api/v1/users/:id
 * Soft-delete (deactivate) user account
 */
function deleteUser(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userId = parseInt(req.params.id);
            const user = yield users_service_1.default.deleteUser(userId);
            res.status(200).json({
                success: true,
                message: 'User deleted successfully',
                data: user,
            });
        }
        catch (error) {
            next(error);
        }
    });
}
/**
 * PATCH /api/v1/users/:id/deactivate
 * Deactivate user account
 */
function deactivateUser(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userId = parseInt(req.params.id);
            const user = yield users_service_1.default.deactivateUser(userId);
            res.status(200).json({
                success: true,
                message: 'User deactivated successfully',
                data: user,
            });
        }
        catch (error) {
            next(error);
        }
    });
}
/**
 * PATCH /api/v1/users/:id/activate
 * Reactivate user account
 */
function activateUser(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userId = parseInt(req.params.id);
            const user = yield users_service_1.default.activateUser(userId);
            res.status(200).json({
                success: true,
                message: 'User activated successfully',
                data: user,
            });
        }
        catch (error) {
            next(error);
        }
    });
}
/**
 * PATCH /api/v1/users/:id/approve
 * Approve a student so they can sign in
 */
function approveStudent(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userId = parseInt(req.params.id);
            const user = yield users_service_1.default.approveStudent(userId);
            res.status(200).json({
                success: true,
                message: 'Student approved successfully',
                data: user,
            });
        }
        catch (error) {
            next(error);
        }
    });
}
exports.default = {
    getUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    deactivateUser,
    activateUser,
};
