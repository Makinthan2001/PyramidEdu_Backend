"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateMobileStudent = authenticateMobileStudent;
const client_1 = require("@prisma/client");
const jwt_util_1 = require("../../../../utils/jwt.util");
const AppError_1 = require("../../../../utils/AppError");
function authenticateMobileStudent(req, _res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AppError_1.AppError('Authentication required. Please log in.', 401);
        }
        const token = authHeader.slice(7);
        const payload = (0, jwt_util_1.verifyAccessToken)(token);
        if (payload.role !== client_1.UserRole.STUDENT) {
            throw new AppError_1.AppError('Access restricted to student accounts.', 403);
        }
        req.user = payload;
        next();
    }
    catch (error) {
        next(error);
    }
}
exports.default = authenticateMobileStudent;
