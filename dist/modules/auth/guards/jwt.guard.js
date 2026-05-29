"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwtGuard = jwtGuard;
const jwt_util_1 = require("../../../utils/jwt.util");
const AppError_1 = require("../../../utils/AppError");
/**
 * JWT Guard - Verifies JWT token and attaches user data to request
 */
function jwtGuard(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next(new AppError_1.AppError('No authorization token provided.', 401));
        }
        const token = authHeader.slice(7);
        const payload = (0, jwt_util_1.verifyAccessToken)(token);
        // Attach user data to request
        req.user = payload;
        req.userId = payload.sub;
        req.userRole = payload.role;
        next();
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            next(error);
        }
        else {
            next(new AppError_1.AppError('Invalid or expired token.', 401));
        }
    }
}
exports.default = jwtGuard;
