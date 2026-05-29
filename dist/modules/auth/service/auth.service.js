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
exports.registerUser = registerUser;
exports.loginUser = loginUser;
exports.refreshAccessToken = refreshAccessToken;
exports.logoutUser = logoutUser;
exports.getCurrentUser = getCurrentUser;
exports.changePassword = changePassword;
exports.forgotPassword = forgotPassword;
exports.resetPassword = resetPassword;
const client_1 = require("@prisma/client");
const prisma_config_1 = __importDefault(require("../../../config/prisma.config"));
const password_util_1 = require("../../../utils/password.util");
const jwt_util_1 = require("../../../utils/jwt.util");
const crypto_util_1 = require("../../../utils/crypto.util");
const AppError_1 = require("../../../utils/AppError");
function toSafeUser(user) {
    return {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        forcePasswordChange: user.forcePasswordChange,
        createdAt: user.createdAt,
    };
}
function registerUser(dto) {
    return __awaiter(this, void 0, void 0, function* () {
        const existing = yield prisma_config_1.default.user.findUnique({ where: { email: dto.email } });
        if (existing) {
            throw new AppError_1.AppError('An account with this email already exists.', 409);
        }
        const passwordHash = yield (0, password_util_1.hashPassword)(dto.password);
        const user = yield prisma_config_1.default.user.create({
            data: {
                email: dto.email,
                passwordHash,
                role: dto.role,
            },
        });
        return toSafeUser(user);
    });
}
function loginUser(dto) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield prisma_config_1.default.user.findUnique({ where: { email: dto.email } });
        if (!user) {
            throw new AppError_1.AppError('Invalid email or password.', 401);
        }
        if (!user.isActive) {
            throw new AppError_1.AppError('Your account has been deactivated. Please contact an administrator.', 403);
        }
        const isMatch = yield (0, password_util_1.comparePasswords)(dto.password, user.passwordHash);
        if (!isMatch) {
            throw new AppError_1.AppError('Invalid email or password.', 401);
        }
        // If user is a student, ensure their student profile is approved
        if (user.role === client_1.UserRole.STUDENT) {
            const student = yield prisma_config_1.default.student.findUnique({ where: { userId: user.id } });
            // Prisma client types may be out-of-sync with schema during migrations; cast to any for safety
            if (!student || student.isApproved === false) {
                throw new AppError_1.AppError('Your account is pending approval. Please contact the administration.', 403);
            }
        }
        const tokenFamily = (0, crypto_util_1.generateTokenFamily)();
        const accessToken = (0, jwt_util_1.generateAccessToken)({ sub: user.id, email: user.email, role: user.role });
        const refreshToken = (0, jwt_util_1.generateRefreshToken)(user.id, tokenFamily);
        const refreshExpires = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
        yield prisma_config_1.default.refreshToken.create({
            data: {
                userId: user.id,
                tokenHash: (0, crypto_util_1.hashToken)(refreshToken),
                tokenFamily,
                expiresAt: (0, jwt_util_1.expiryStringToDate)(refreshExpires),
            },
        });
        return {
            user: toSafeUser(user),
            tokens: { accessToken, refreshToken },
        };
    });
}
function refreshAccessToken(refreshToken) {
    return __awaiter(this, void 0, void 0, function* () {
        const payload = (0, jwt_util_1.verifyRefreshToken)(refreshToken);
        const tokenHash = (0, crypto_util_1.hashToken)(refreshToken);
        const stored = yield prisma_config_1.default.refreshToken.findUnique({ where: { tokenHash } });
        if (!stored) {
            yield prisma_config_1.default.refreshToken.deleteMany({ where: { userId: payload.sub } });
            throw new AppError_1.AppError('Refresh token reuse detected. All sessions have been terminated.', 401);
        }
        if (stored.tokenFamily !== payload.tokenFamily) {
            yield prisma_config_1.default.refreshToken.deleteMany({ where: { userId: payload.sub } });
            throw new AppError_1.AppError('Token family mismatch. Please log in again.', 401);
        }
        if (stored.expiresAt < new Date()) {
            yield prisma_config_1.default.refreshToken.delete({ where: { tokenHash } });
            throw new AppError_1.AppError('Refresh token has expired. Please log in again.', 401);
        }
        const user = yield prisma_config_1.default.user.findUnique({ where: { id: payload.sub } });
        if (!user || !user.isActive) {
            yield prisma_config_1.default.refreshToken.deleteMany({ where: { userId: payload.sub } });
            throw new AppError_1.AppError('User not found or account deactivated.', 401);
        }
        yield prisma_config_1.default.refreshToken.delete({ where: { tokenHash } });
        const newRefreshToken = (0, jwt_util_1.generateRefreshToken)(user.id, payload.tokenFamily);
        const newAccessToken = (0, jwt_util_1.generateAccessToken)({ sub: user.id, email: user.email, role: user.role });
        const refreshExpires = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
        yield prisma_config_1.default.refreshToken.create({
            data: {
                userId: user.id,
                tokenHash: (0, crypto_util_1.hashToken)(newRefreshToken),
                tokenFamily: payload.tokenFamily,
                expiresAt: (0, jwt_util_1.expiryStringToDate)(refreshExpires),
            },
        });
        return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    });
}
function logoutUser(refreshToken_1) {
    return __awaiter(this, arguments, void 0, function* (refreshToken, logoutAll = false) {
        try {
            const payload = (0, jwt_util_1.verifyRefreshToken)(refreshToken);
            if (logoutAll) {
                yield prisma_config_1.default.refreshToken.deleteMany({ where: { userId: payload.sub } });
                return;
            }
            yield prisma_config_1.default.refreshToken.deleteMany({ where: { tokenHash: (0, crypto_util_1.hashToken)(refreshToken) } });
        }
        catch (_a) {
            return;
        }
    });
}
function getCurrentUser(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield prisma_config_1.default.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new AppError_1.AppError('User not found.', 404);
        }
        return toSafeUser(user);
    });
}
function changePassword(userId, dto) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield prisma_config_1.default.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new AppError_1.AppError('User not found.', 404);
        }
        const isMatch = yield (0, password_util_1.comparePasswords)(dto.currentPassword, user.passwordHash);
        if (!isMatch) {
            throw new AppError_1.AppError('Current password is incorrect.', 400);
        }
        const newHash = yield (0, password_util_1.hashPassword)(dto.newPassword);
        yield prisma_config_1.default.$transaction([
            prisma_config_1.default.user.update({
                where: { id: userId },
                data: { passwordHash: newHash },
            }),
            prisma_config_1.default.refreshToken.deleteMany({ where: { userId } }),
        ]);
    });
}
function forgotPassword(dto) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield prisma_config_1.default.user.findUnique({ where: { email: dto.email } });
        if (!user || !user.isActive) {
            return null;
        }
        const resetToken = (0, jwt_util_1.generateResetToken)(user.id);
        if (process.env.NODE_ENV !== 'production') {
            return resetToken;
        }
        return null;
    });
}
function resetPassword(dto) {
    return __awaiter(this, void 0, void 0, function* () {
        const payload = (0, jwt_util_1.verifyResetToken)(dto.token);
        const user = yield prisma_config_1.default.user.findUnique({ where: { id: payload.sub } });
        if (!user || !user.isActive) {
            throw new AppError_1.AppError('User not found or account is inactive.', 400);
        }
        const newHash = yield (0, password_util_1.hashPassword)(dto.newPassword);
        yield prisma_config_1.default.$transaction([
            prisma_config_1.default.user.update({
                where: { id: user.id },
                data: { passwordHash: newHash },
            }),
            prisma_config_1.default.refreshToken.deleteMany({ where: { userId: user.id } }),
        ]);
    });
}
