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
exports.loginStudent = loginStudent;
exports.refreshAccessToken = refreshAccessToken;
exports.logoutStudent = logoutStudent;
exports.getCurrentStudent = getCurrentStudent;
const client_1 = require("@prisma/client");
const AppError_1 = require("../../../../utils/AppError");
const password_util_1 = require("../../../../utils/password.util");
const jwt_util_1 = require("../../../../utils/jwt.util");
const crypto_util_1 = require("../../../../utils/crypto.util");
const auth_repository_1 = __importDefault(require("../repository/auth.repository"));
const MOBILE_ACCESS_EXPIRES = process.env.JWT_MOBILE_ACCESS_EXPIRES_IN || process.env.JWT_ACCESS_EXPIRES_IN || '10m';
const MOBILE_REFRESH_EXPIRES = process.env.JWT_MOBILE_REFRESH_EXPIRES_IN || '30d';
function toStudentSession(user) {
    var _a, _b;
    if (!user.student) {
        throw new AppError_1.AppError('Student profile not found.', 404);
    }
    return {
        id: user.id,
        email: user.email,
        role: 'STUDENT',
        isActive: user.isActive,
        forcePasswordChange: user.forcePasswordChange,
        createdAt: user.createdAt,
        student: {
            id: user.student.id,
            firstName: user.student.firstName,
            lastName: user.student.lastName,
            indexNumber: user.student.indexNumber,
            phone: (_a = user.student.phone) !== null && _a !== void 0 ? _a : null,
            address: (_b = user.student.address) !== null && _b !== void 0 ? _b : null,
            dateOfBirth: user.student.dateOfBirth ? user.student.dateOfBirth.toISOString().slice(0, 10) : null,
        },
    };
}
function loginStudent(dto) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield auth_repository_1.default.findStudentByEmail(dto.email.trim().toLowerCase());
        if (!user || user.role !== client_1.UserRole.STUDENT || !user.student) {
            throw new AppError_1.AppError('Invalid email or password.', 401);
        }
        if (!user.isActive) {
            throw new AppError_1.AppError('Your account has been deactivated. Please contact the school administration.', 403);
        }
        const isMatch = yield (0, password_util_1.comparePasswords)(dto.password, user.passwordHash);
        if (!isMatch) {
            throw new AppError_1.AppError('Invalid email or password.', 401);
        }
        // Ensure student profile has been approved
        if (!user.student || user.student.isApproved === false) {
            throw new AppError_1.AppError('Your account is pending approval. Please contact the school administration.', 403);
        }
        const tokenFamily = (0, crypto_util_1.generateTokenFamily)();
        const accessToken = (0, jwt_util_1.generateAccessToken)({ sub: user.id, email: user.email, role: user.role }, MOBILE_ACCESS_EXPIRES);
        const refreshToken = (0, jwt_util_1.generateRefreshToken)(user.id, tokenFamily, MOBILE_REFRESH_EXPIRES);
        yield auth_repository_1.default.createRefreshToken({
            userId: user.id,
            tokenHash: (0, crypto_util_1.hashToken)(refreshToken),
            tokenFamily,
            expiresAt: (0, jwt_util_1.expiryStringToDate)(MOBILE_REFRESH_EXPIRES),
        });
        return {
            student: toStudentSession(user),
            tokens: { accessToken, refreshToken },
        };
    });
}
function refreshAccessToken(refreshToken) {
    return __awaiter(this, void 0, void 0, function* () {
        const payload = (0, jwt_util_1.verifyRefreshToken)(refreshToken);
        const tokenHash = (0, crypto_util_1.hashToken)(refreshToken);
        const stored = yield auth_repository_1.default.findRefreshTokenByHash(tokenHash);
        if (!stored) {
            yield auth_repository_1.default.deleteRefreshTokensByUserId(payload.sub);
            throw new AppError_1.AppError('Refresh token reuse detected. All sessions have been terminated.', 401);
        }
        if (stored.tokenFamily !== payload.tokenFamily) {
            yield auth_repository_1.default.deleteRefreshTokensByUserId(payload.sub);
            throw new AppError_1.AppError('Token family mismatch. Please log in again.', 401);
        }
        if (stored.expiresAt < new Date()) {
            yield auth_repository_1.default.deleteRefreshTokenByHash(tokenHash);
            throw new AppError_1.AppError('Refresh token has expired. Please log in again.', 401);
        }
        const user = yield auth_repository_1.default.findStudentById(payload.sub);
        if (!user || user.role !== client_1.UserRole.STUDENT || !user.isActive || !user.student) {
            yield auth_repository_1.default.deleteRefreshTokensByUserId(payload.sub);
            throw new AppError_1.AppError('Student account not found or inactive.', 401);
        }
        yield auth_repository_1.default.deleteRefreshTokenByHash(tokenHash);
        const newRefreshToken = (0, jwt_util_1.generateRefreshToken)(user.id, payload.tokenFamily, MOBILE_REFRESH_EXPIRES);
        const newAccessToken = (0, jwt_util_1.generateAccessToken)({ sub: user.id, email: user.email, role: user.role }, MOBILE_ACCESS_EXPIRES);
        yield auth_repository_1.default.createRefreshToken({
            userId: user.id,
            tokenHash: (0, crypto_util_1.hashToken)(newRefreshToken),
            tokenFamily: payload.tokenFamily,
            expiresAt: (0, jwt_util_1.expiryStringToDate)(MOBILE_REFRESH_EXPIRES),
        });
        return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    });
}
function logoutStudent(refreshToken_1) {
    return __awaiter(this, arguments, void 0, function* (refreshToken, logoutAll = false) {
        try {
            const payload = (0, jwt_util_1.verifyRefreshToken)(refreshToken);
            if (logoutAll) {
                yield auth_repository_1.default.deleteRefreshTokensByUserId(payload.sub);
                return;
            }
            yield auth_repository_1.default.deleteRefreshTokenByHash((0, crypto_util_1.hashToken)(refreshToken));
        }
        catch (_a) {
            return;
        }
    });
}
function getCurrentStudent(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield auth_repository_1.default.findStudentById(userId);
        if (!user || user.role !== client_1.UserRole.STUDENT || !user.student) {
            throw new AppError_1.AppError('Student account not found.', 404);
        }
        return toStudentSession(user);
    });
}
