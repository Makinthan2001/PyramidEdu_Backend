"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.studentOnly = exports.teacherOnly = exports.staffOnly = exports.adminOrManager = exports.adminOnly = void 0;
exports.authorize = authorize;
const client_1 = require("@prisma/client");
const AppError_1 = require("../utils/AppError");
function authorize(...allowedRoles) {
    return (req, _res, next) => {
        if (!req.user) {
            next(new AppError_1.AppError('Authentication required.', 401));
            return;
        }
        if (!allowedRoles.includes(req.user.role)) {
            next(new AppError_1.AppError(`Access denied. Required role(s): ${allowedRoles.join(', ')}.`, 403));
            return;
        }
        next();
    };
}
// Convenience middlewares for 4 roles
exports.adminOnly = authorize(client_1.UserRole.ADMIN);
exports.adminOrManager = authorize(client_1.UserRole.ADMIN, client_1.UserRole.MANAGER);
exports.staffOnly = authorize(client_1.UserRole.ADMIN, client_1.UserRole.MANAGER, client_1.UserRole.TEACHER);
exports.teacherOnly = authorize(client_1.UserRole.TEACHER);
exports.studentOnly = authorize(client_1.UserRole.STUDENT);
