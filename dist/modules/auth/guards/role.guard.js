"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleGuard = roleGuard;
exports.adminOnly = adminOnly;
exports.managerOrAdmin = managerOrAdmin;
const client_1 = require("@prisma/client");
const AppError_1 = require("../../../utils/AppError");
/**
 * Role Guard - Checks if user has required role
 */
function roleGuard(...allowedRoles) {
    return (req, res, next) => {
        const userRole = req.userRole;
        if (!userRole) {
            return next(new AppError_1.AppError('User role not found. Please authenticate first.', 401));
        }
        if (!allowedRoles.includes(userRole)) {
            return next(new AppError_1.AppError(`Insufficient permissions. Required roles: ${allowedRoles.join(', ')}`, 403));
        }
        next();
    };
}
/**
 * Admin Only Guard
 */
function adminOnly(req, res, next) {
    const userRole = req.userRole;
    if (!userRole) {
        return next(new AppError_1.AppError('User role not found. Please authenticate first.', 401));
    }
    if (userRole !== client_1.UserRole.ADMIN) {
        return next(new AppError_1.AppError('Only administrators can access this resource.', 403));
    }
    next();
}
/**
 * Manager or Admin Guard
 */
function managerOrAdmin(req, res, next) {
    const userRole = req.userRole;
    if (!userRole) {
        return next(new AppError_1.AppError('User role not found. Please authenticate first.', 401));
    }
    const allowedForManagerOrAdmin = [client_1.UserRole.ADMIN, client_1.UserRole.MANAGER];
    if (!allowedForManagerOrAdmin.includes(userRole)) {
        return next(new AppError_1.AppError('Only managers and administrators can access this resource.', 403));
    }
    next();
}
exports.default = roleGuard;
