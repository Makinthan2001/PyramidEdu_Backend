"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshTokenSchema = exports.registerSchema = exports.changePasswordSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
// Import DTOs
var login_dto_1 = require("../dto/login.dto");
Object.defineProperty(exports, "loginSchema", { enumerable: true, get: function () { return login_dto_1.loginSchema; } });
var forgot_password_dto_1 = require("../dto/forgot-password.dto");
Object.defineProperty(exports, "forgotPasswordSchema", { enumerable: true, get: function () { return forgot_password_dto_1.forgotPasswordSchema; } });
var reset_password_dto_1 = require("../dto/reset-password.dto");
Object.defineProperty(exports, "resetPasswordSchema", { enumerable: true, get: function () { return reset_password_dto_1.resetPasswordSchema; } });
var change_password_dto_1 = require("../dto/change-password.dto");
Object.defineProperty(exports, "changePasswordSchema", { enumerable: true, get: function () { return change_password_dto_1.changePasswordSchema; } });
const passwordField = zod_1.z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(72, 'Password must be at most 72 characters.')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
    .regex(/[0-9]/, 'Password must contain at least one number.');
const emailField = zod_1.z.string().email('Please provide a valid email address.');
exports.registerSchema = zod_1.z.object({
    email: emailField,
    password: passwordField,
    fullName: zod_1.z.string().min(2, 'Full name is required.').max(100),
    role: zod_1.z.nativeEnum(client_1.Role).refine((role) => role !== client_1.Role.STUDENT, {
        message: 'Role must be ADMIN, MANAGER, or TEACHER.',
    }),
});
exports.refreshTokenSchema = zod_1.z.object({});
