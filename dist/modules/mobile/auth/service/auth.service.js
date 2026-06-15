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
const auth_repository_1 = __importDefault(require("../repository/auth.repository"));
const MOBILE_ACCESS_EXPIRES = process.env.JWT_MOBILE_ACCESS_EXPIRES_IN || process.env.JWT_ACCESS_EXPIRES_IN || '10m';
const MOBILE_REFRESH_EXPIRES = process.env.JWT_MOBILE_REFRESH_EXPIRES_IN || '30d';
function toStudentSession(user) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    if (!user.student) {
        throw new AppError_1.AppError('Student profile not found.', 404);
    }
    return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        profileImage: (_a = user.profileImage) !== null && _a !== void 0 ? _a : null,
        role: client_1.Role.STUDENT,
        isActive: user.isActive,
        forcePwdChange: user.forcePwdChange,
        createdAt: user.createdAt,
        student: {
            id: user.student.id,
            indexNumber: (_b = user.student.indexNumber) !== null && _b !== void 0 ? _b : null,
            phone: (_c = user.student.phone) !== null && _c !== void 0 ? _c : null,
            address: (_d = user.student.address) !== null && _d !== void 0 ? _d : null,
            dateOfBirth: user.student.dateOfBirth ? user.student.dateOfBirth.toISOString().slice(0, 10) : null,
            gender: (_e = user.student.gender) !== null && _e !== void 0 ? _e : null,
            school: (_f = user.student.school) !== null && _f !== void 0 ? _f : null,
            batch: (_g = user.student.batch) !== null && _g !== void 0 ? _g : null,
            nic: (_h = user.student.nic) !== null && _h !== void 0 ? _h : null,
            rewardPoints: user.student.rewardPoints,
            attendancePercentage: Number(user.student.attendancePercentage),
            performanceStatus: (_j = user.student.performanceStatus) !== null && _j !== void 0 ? _j : null,
            trendStatus: (_k = user.student.trendStatus) !== null && _k !== void 0 ? _k : null,
            approvalStatus: user.student.approvalStatus,
            paymentStatus: user.student.paymentStatus,
            totalFeeAmount: Number(user.student.totalFeeAmount),
        },
    };
}
function loginStudent(dto) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield auth_repository_1.default.findStudentByEmail(dto.email.trim().toLowerCase());
        if (!user || user.role !== client_1.Role.STUDENT || !user.student) {
            throw new AppError_1.AppError('Invalid email or password.', 401);
        }
        if (!user.isActive) {
            throw new AppError_1.AppError('Your account has been deactivated. Please contact the school administration.', 403);
        }
        const isMatch = yield (0, password_util_1.comparePasswords)(dto.password, user.password);
        if (!isMatch) {
            throw new AppError_1.AppError('Invalid email or password.', 401);
        }
        // Ensure student profile has been approved
        if (!user.student || user.student.approvalStatus !== 'APPROVED') {
            throw new AppError_1.AppError('Your account is pending approval. Please contact the school administration.', 403);
        }
        const accessToken = (0, jwt_util_1.generateAccessToken)({ sub: user.id, email: user.email, role: user.role }, MOBILE_ACCESS_EXPIRES);
        const refreshToken = (0, jwt_util_1.generateRefreshToken)(user.id, MOBILE_REFRESH_EXPIRES);
        yield auth_repository_1.default.createRefreshToken({
            userId: user.id,
            token: refreshToken,
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
        const stored = yield auth_repository_1.default.findRefreshTokenByToken(refreshToken);
        if (!stored) {
            yield auth_repository_1.default.deleteRefreshTokensByUserId(payload.sub);
            throw new AppError_1.AppError('Refresh token reuse detected. All sessions have been terminated.', 401);
        }
        if (stored.expiresAt < new Date()) {
            yield auth_repository_1.default.deleteRefreshTokenByToken(refreshToken);
            throw new AppError_1.AppError('Refresh token has expired. Please log in again.', 401);
        }
        const user = yield auth_repository_1.default.findStudentById(payload.sub);
        if (!user || user.role !== client_1.Role.STUDENT || !user.isActive || !user.student) {
            yield auth_repository_1.default.deleteRefreshTokensByUserId(payload.sub);
            throw new AppError_1.AppError('Student account not found or inactive.', 401);
        }
        yield auth_repository_1.default.deleteRefreshTokenByToken(refreshToken);
        const newRefreshToken = (0, jwt_util_1.generateRefreshToken)(user.id, MOBILE_REFRESH_EXPIRES);
        const newAccessToken = (0, jwt_util_1.generateAccessToken)({ sub: user.id, email: user.email, role: user.role }, MOBILE_ACCESS_EXPIRES);
        yield auth_repository_1.default.createRefreshToken({
            userId: user.id,
            token: newRefreshToken,
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
            yield auth_repository_1.default.deleteRefreshTokenByToken(refreshToken);
        }
        catch (_a) {
            return;
        }
    });
}
function getCurrentStudent(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield auth_repository_1.default.findStudentById(userId);
        if (!user || user.role !== client_1.Role.STUDENT || !user.student) {
            throw new AppError_1.AppError('Student account not found.', 404);
        }
        return toStudentSession(user);
    });
}
