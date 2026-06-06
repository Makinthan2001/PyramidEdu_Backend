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
const AppError_1 = require("../../../utils/AppError");
const userProfileInclude = {
    student: true,
    teacher: true,
    manager: true,
    admin: true,
};
function toSafeUser(user) {
    const response = {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
        forcePwdChange: user.forcePwdChange,
        createdAt: user.createdAt,
        phone: user.phone || undefined,
    };
    if (user.student) {
        response.phone = user.student.phone || response.phone;
        response.address = user.student.address || undefined;
    }
    if (user.teacher) {
        response.phone = user.teacher.phone || response.phone;
        response.address = user.teacher.address || undefined;
    }
    if (user.manager) {
        response.address = user.manager.address || undefined;
    }
    return response;
}
function registerUser(dto) {
    return __awaiter(this, void 0, void 0, function* () {
        const email = dto.email.trim().toLowerCase();
        const existing = yield prisma_config_1.default.user.findUnique({ where: { email } });
        if (existing) {
            throw new AppError_1.AppError('An account with this email already exists.', 409);
        }
        const hashedPassword = yield (0, password_util_1.hashPassword)(dto.password);
        let user;
        yield prisma_config_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
            user = yield tx.user.create({
                data: {
                    email,
                    fullName: dto.fullName,
                    password: hashedPassword,
                    role: dto.role,
                },
            });
            if (dto.role === client_1.Role.ADMIN) {
                yield tx.admin.create({
                    data: {
                        userId: user.id,
                        accessLevel: 1,
                    },
                });
            }
            else if (dto.role === client_1.Role.MANAGER) {
                yield tx.manager.create({
                    data: {
                        userId: user.id,
                    },
                });
            }
            else if (dto.role === client_1.Role.TEACHER) {
                yield tx.teacher.create({
                    data: {
                        userId: user.id,
                    },
                });
            }
        }));
        return toSafeUser(user);
    });
}
function loginUser(dto) {
    return __awaiter(this, void 0, void 0, function* () {
        const email = dto.email.trim().toLowerCase();
        const user = yield prisma_config_1.default.user.findUnique({
            where: { email },
            include: userProfileInclude,
        });
        if (!user) {
            throw new AppError_1.AppError('Invalid email or password.', 401);
        }
        if (!user.isActive) {
            throw new AppError_1.AppError('Your account has been deactivated. Please contact an administrator.', 403);
        }
        if (!dto.password || typeof dto.password !== 'string') {
            throw new AppError_1.AppError('Password is required.', 400);
        }
        const incomingPassword = dto.password;
        const isMatch = yield (0, password_util_1.comparePasswords)(incomingPassword, user.password);
        if (!isMatch) {
            console.warn(`Failed login attempt for ${email}: password did not match stored hash.`);
            throw new AppError_1.AppError('Invalid email or password.', 401);
        }
        if (user.role === client_1.Role.STUDENT) {
            const student = yield prisma_config_1.default.student.findUnique({ where: { userId: user.id } });
            if (!student || student.isApproved === false) {
                throw new AppError_1.AppError('Your account is pending approval. Please contact the administration.', 403);
            }
        }
        const accessToken = (0, jwt_util_1.generateAccessToken)({ sub: user.id, email: user.email, role: user.role });
        const refreshToken = (0, jwt_util_1.generateRefreshToken)(user.id);
        const refreshExpires = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
        yield prisma_config_1.default.refreshToken.create({
            data: {
                userId: user.id,
                token: refreshToken,
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
        const stored = yield prisma_config_1.default.refreshToken.findUnique({ where: { token: refreshToken } });
        if (!stored) {
            yield prisma_config_1.default.refreshToken.deleteMany({ where: { userId: payload.sub } });
            throw new AppError_1.AppError('Refresh token reuse detected. All sessions have been terminated.', 401);
        }
        if (stored.expiresAt < new Date()) {
            yield prisma_config_1.default.refreshToken.delete({ where: { token: refreshToken } });
            throw new AppError_1.AppError('Refresh token has expired. Please log in again.', 401);
        }
        const user = yield prisma_config_1.default.user.findUnique({ where: { id: payload.sub } });
        if (!user || !user.isActive) {
            yield prisma_config_1.default.refreshToken.deleteMany({ where: { userId: payload.sub } });
            throw new AppError_1.AppError('User not found or account deactivated.', 401);
        }
        yield prisma_config_1.default.refreshToken.delete({ where: { token: refreshToken } });
        const newRefreshToken = (0, jwt_util_1.generateRefreshToken)(user.id);
        const newAccessToken = (0, jwt_util_1.generateAccessToken)({ sub: user.id, email: user.email, role: user.role });
        const refreshExpires = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
        yield prisma_config_1.default.refreshToken.create({
            data: {
                userId: user.id,
                token: newRefreshToken,
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
            yield prisma_config_1.default.refreshToken.delete({ where: { token: refreshToken } });
        }
        catch (_a) {
            return;
        }
    });
}
function getCurrentUser(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield prisma_config_1.default.user.findUnique({
            where: { id: userId },
            include: userProfileInclude,
        });
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
        const isMatch = yield (0, password_util_1.comparePasswords)(dto.currentPassword, user.password);
        if (!isMatch) {
            throw new AppError_1.AppError('Current password is incorrect.', 400);
        }
        const newHash = yield (0, password_util_1.hashPassword)(dto.newPassword);
        yield prisma_config_1.default.$transaction([
            prisma_config_1.default.user.update({
                where: { id: userId },
                data: { password: newHash },
            }),
            prisma_config_1.default.refreshToken.deleteMany({ where: { userId } }),
        ]);
    });
}
function forgotPassword(dto) {
    return __awaiter(this, void 0, void 0, function* () {
        const email = dto.email.trim().toLowerCase();
        const user = yield prisma_config_1.default.user.findUnique({ where: { email } });
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
                data: { password: newHash },
            }),
            prisma_config_1.default.refreshToken.deleteMany({ where: { userId: user.id } }),
        ]);
    });
}
