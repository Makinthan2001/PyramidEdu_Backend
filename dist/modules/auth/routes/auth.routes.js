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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const validate_1 = require("../../../middleware/validate");
const authenticate_1 = require("../../../middleware/authenticate");
const controller = __importStar(require("../controller/auth.controller"));
const auth_validator_1 = require("../validators/auth.validator");
const login_dto_1 = require("../dto/login.dto");
const change_password_dto_1 = require("../dto/change-password.dto");
const forgot_password_dto_1 = require("../dto/forgot-password.dto");
const reset_password_dto_1 = require("../dto/reset-password.dto");
const router = (0, express_1.Router)();
router.post('/register', (0, validate_1.validate)(auth_validator_1.registerSchema), controller.register);
router.post('/login', (0, validate_1.validate)(login_dto_1.loginSchema), controller.login);
router.post('/refresh', controller.refreshToken);
router.post('/logout', controller.logout);
router.post('/forgot-password', (0, validate_1.validate)(forgot_password_dto_1.forgotPasswordSchema), controller.forgotPassword);
router.post('/reset-password', (0, validate_1.validate)(reset_password_dto_1.resetPasswordSchema), controller.resetPassword);
router.get('/me', authenticate_1.authenticate, controller.getMe);
router.patch('/change-password', authenticate_1.authenticate, (0, validate_1.validate)(change_password_dto_1.changePasswordSchema), controller.changePassword);
exports.default = router;
