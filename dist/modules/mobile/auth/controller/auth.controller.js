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
exports.login = login;
exports.refreshToken = refreshToken;
exports.logout = logout;
exports.getMe = getMe;
const AppError_1 = require("../../../../utils/AppError");
const authService = __importStar(require("../service/auth.service"));
function login(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const dto = req.body;
            const { student, tokens } = yield authService.loginStudent(dto);
            res.status(200).json({
                success: true,
                message: 'Login successful.',
                data: {
                    student,
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
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
        try {
            const dto = req.body;
            const tokens = yield authService.refreshAccessToken(dto.refreshToken);
            res.status(200).json({
                success: true,
                message: 'Token refreshed successfully.',
                data: tokens,
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
            const dto = req.body;
            yield authService.logoutStudent(dto.refreshToken, (_a = dto.logoutAll) !== null && _a !== void 0 ? _a : false);
            res.status(200).json({
                success: true,
                message: dto.logoutAll ? 'Logged out from all devices.' : 'Logged out successfully.',
            });
        }
        catch (error) {
            next(error);
        }
    });
}
function getMe(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.sub;
            if (!userId) {
                throw new AppError_1.AppError('Authentication required. Please log in.', 401);
            }
            const student = yield authService.getCurrentStudent(userId);
            res.status(200).json({
                success: true,
                data: { student },
            });
        }
        catch (error) {
            next(error);
        }
    });
}
exports.default = {
    login,
    refreshToken,
    logout,
    getMe,
};
