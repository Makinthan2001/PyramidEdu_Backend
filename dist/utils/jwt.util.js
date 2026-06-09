"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAccessToken = generateAccessToken;
exports.verifyAccessToken = verifyAccessToken;
exports.generateRefreshToken = generateRefreshToken;
exports.verifyRefreshToken = verifyRefreshToken;
exports.generateResetToken = generateResetToken;
exports.verifyResetToken = verifyResetToken;
exports.expiryStringToDate = expiryStringToDate;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const AppError_1 = require("./AppError");
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const RESET_SECRET = process.env.JWT_RESET_SECRET;
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const RESET_EXPIRES = process.env.JWT_RESET_EXPIRES_IN || '15m';
function requireSecret(secret, name) {
    if (!secret) {
        throw new Error(`Missing environment variable: ${name}`);
    }
    return secret;
}
function generateAccessToken(payload, expiresIn = ACCESS_EXPIRES) {
    return jsonwebtoken_1.default.sign(payload, requireSecret(ACCESS_SECRET, 'JWT_ACCESS_SECRET'), {
        expiresIn,
    });
}
function verifyAccessToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, requireSecret(ACCESS_SECRET, 'JWT_ACCESS_SECRET'));
    }
    catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new AppError_1.AppError('Access token has expired. Please refresh.', 401);
        }
        throw new AppError_1.AppError('Invalid access token.', 401);
    }
}
function generateRefreshToken(userId, expiresIn = REFRESH_EXPIRES) {
    return jsonwebtoken_1.default.sign({ sub: userId }, requireSecret(REFRESH_SECRET, 'JWT_REFRESH_SECRET'), { expiresIn });
}
function verifyRefreshToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, requireSecret(REFRESH_SECRET, 'JWT_REFRESH_SECRET'));
    }
    catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new AppError_1.AppError('Refresh token has expired. Please log in again.', 401);
        }
        throw new AppError_1.AppError('Invalid refresh token.', 401);
    }
}
function generateResetToken(userId) {
    return jsonwebtoken_1.default.sign({ sub: userId, purpose: 'password_reset' }, requireSecret(RESET_SECRET, 'JWT_RESET_SECRET'), { expiresIn: RESET_EXPIRES });
}
function verifyResetToken(token) {
    try {
        const payload = jsonwebtoken_1.default.verify(token, requireSecret(RESET_SECRET, 'JWT_RESET_SECRET'));
        if (payload.purpose !== 'password_reset') {
            throw new AppError_1.AppError('Token is not a password-reset token.', 400);
        }
        return payload;
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            throw error;
        }
        if (error.name === 'TokenExpiredError') {
            throw new AppError_1.AppError('Password-reset link has expired. Please request a new one.', 400);
        }
        throw new AppError_1.AppError('Invalid password-reset token.', 400);
    }
}
function expiryStringToDate(expiry) {
    var _a;
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1), 10);
    const milliseconds = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
    };
    return new Date(Date.now() + ((_a = milliseconds[unit]) !== null && _a !== void 0 ? _a : 0) * value);
}
