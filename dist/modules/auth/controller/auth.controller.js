"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.refreshToken = refreshToken;
exports.logout = logout;
exports.getMe = getMe;
exports.changePassword = changePassword;
exports.forgotPassword = forgotPassword;
exports.resetPassword = resetPassword;
const authService = __importStar(require("../service/auth.service"));
const AppError_1 = require("../../../utils/AppError");
const REFRESH_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api',
};
function register(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const dto = req.body;
            const user = yield authService.registerUser(dto);
            res.status(201).json({
                success: true,
                message: 'Account created successfully.',
                data: { user },
            });
        }
        catch (error) {
            next(error);
        }
    });
}
function login(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const dto = req.body;
            const { user, tokens } = yield authService.loginUser(dto);
            res.cookie('refreshToken', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
            res.status(200).json({
                success: true,
                message: 'Login successful.',
                data: {
                    user,
                    accessToken: tokens.accessToken,
                },
            });
        }
        catch (error) {
            next(error);
        }
    });
}
function refreshToken(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const token = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.refreshToken;
            if (!token) {
                throw new AppError_1.AppError('No refresh token provided. Please log in again.', 401);
            }
            const tokens = yield authService.refreshAccessToken(token);
            res.cookie('refreshToken', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
            res.status(200).json({
                success: true,
                message: 'Token refreshed successfully.',
                data: { accessToken: tokens.accessToken },
            });
        }
        catch (error) {
            next(error);
        }
    });
}
function logout(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const token = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.refreshToken;
            const logoutAll = req.query.all === 'true';
            if (token) {
                yield authService.logoutUser(token, logoutAll);
            }
            res.clearCookie('refreshToken', { path: '/api' });
            res.status(200).json({
                success: true,
                message: logoutAll ? 'Logged out from all devices.' : 'Logged out successfully.',
            });
        }
        catch (error) {
            next(error);
        }
    });
}
function getMe(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userId = req.user.sub;
            const user = yield authService.getCurrentUser(userId);
            res.status(200).json({
                success: true,
                data: { user },
            });
        }
        catch (error) {
            next(error);
        }
    });
}
function changePassword(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userId = req.user.sub;
            const dto = req.body;
            yield authService.changePassword(userId, dto);
            res.clearCookie('refreshToken', { path: '/api' });
            res.status(200).json({
                success: true,
                message: 'Password changed successfully. Please log in again.',
            });
        }
        catch (error) {
            next(error);
        }
    });
}
function forgotPassword(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const dto = req.body;
            const token = yield authService.forgotPassword(dto);
            const responseData = {
                message: 'If an account with that email exists, a password-reset link has been sent.',
            };
            if (process.env.NODE_ENV !== 'production' && token) {
                responseData.devResetToken = token;
            }
            res.status(200).json({ success: true, data: responseData });
        }
        catch (error) {
            next(error);
        }
    });
}
function resetPassword(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const dto = req.body;
            yield authService.resetPassword(dto);
            res.status(200).json({
                success: true,
                message: 'Password reset successfully. Please log in with your new password.',
            });
        }
        catch (error) {
            next(error);
        }
    });
}
