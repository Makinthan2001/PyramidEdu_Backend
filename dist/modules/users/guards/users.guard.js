"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUserOwner = isUserOwner;
exports.canAccessUser = canAccessUser;
exports.canManageUsers = canManageUsers;
exports.canCreateRole = canCreateRole;
exports.preventSelfDeactivation = preventSelfDeactivation;
const client_1 = require("@prisma/client");
const AppError_1 = require("../../../utils/AppError");
/**
 * Users Guards - Role-based access control for user operations
 */
/**
 * Check if user is trying to access their own profile
 */
function isUserOwner(req, res, next) {
    const userId = req.userId;
    const targetUserId = parseInt(req.params.id);
    if (!userId) {
        return next(new AppError_1.AppError('User not authenticated.', 401));
    }
    if (userId !== targetUserId) {
        return next(new AppError_1.AppError('You can only access your own profile. Admins have full access.', 403));
    }
    next();
}
/**
 * Check if user can access another user's profile
 * ADMIN: can access anyone
 * Others: can only access their own profile
 */
function canAccessUser(req, res, next) {
    const userRole = req.userRole;
    const userId = req.userId;
    const targetUserId = parseInt(req.params.id);
    if (!userId || !userRole) {
        return next(new AppError_1.AppError('User not authenticated.', 401));
    }
    // ADMIN can access anyone
    if (userRole === client_1.UserRole.ADMIN) {
        return next();
    }
    // Others can only access their own profile
    if (userId !== targetUserId) {
        return next(new AppError_1.AppError('You can only access your own profile.', 403));
    }
    next();
}
/**
 * Check if user can manage users (create, update, delete)
 * ADMIN: can manage all
 * MANAGER: can only manage STUDENT users
 * Others: forbidden
 */
function canManageUsers(req, res, next) {
    const userRole = req.userRole;
    if (!userRole) {
        return next(new AppError_1.AppError('User not authenticated.', 401));
    }
    // ADMIN has full access
    if (userRole === client_1.UserRole.ADMIN) {
        return next();
    }
    // MANAGER can manage students
    if (userRole === client_1.UserRole.MANAGER) {
        return next();
    }
    // Others cannot manage users
    return next(new AppError_1.AppError('You do not have permission to manage users.', 403));
}
/**
 * Check if user can create a specific role
 * ADMIN: can create all roles
 * MANAGER: can only create STUDENT users
 * Others: forbidden
 */
function canCreateRole(req, res, next) {
    const userRole = req.userRole;
    const targetRole = req.body.role;
    if (!userRole) {
        return next(new AppError_1.AppError('User not authenticated.', 401));
    }
    // ADMIN can create all roles
    if (userRole === client_1.UserRole.ADMIN) {
        return next();
    }
    // MANAGER can only create STUDENT users
    if (userRole === client_1.UserRole.MANAGER && targetRole === client_1.UserRole.STUDENT) {
        return next();
    }
    // Others cannot create users
    return next(new AppError_1.AppError(`You cannot create users with role ${targetRole}. Only ADMIN can create all roles, MANAGER can only create STUDENT users.`, 403));
}
/**
 * Prevent self-deactivation by non-admin users
 */
function preventSelfDeactivation(req, res, next) {
    const userId = req.userId;
    const userRole = req.userRole;
    const targetUserId = parseInt(req.params.id);
    if (!userId || !userRole) {
        return next(new AppError_1.AppError('User not authenticated.', 401));
    }
    // ADMIN can deactivate anyone including themselves
    if (userRole === client_1.UserRole.ADMIN) {
        return next();
    }
    // Non-admin users cannot deactivate themselves
    if (userId === targetUserId) {
        return next(new AppError_1.AppError('You cannot deactivate your own account. Contact an administrator.', 403));
    }
    // Non-admin users can only deactivate users they manage
    return next();
}
exports.default = {
    isUserOwner,
    canAccessUser,
    canManageUsers,
    canCreateRole,
    preventSelfDeactivation,
};
