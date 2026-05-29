"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminResetPasswordSchema = exports.changePasswordSchema = void 0;
const zod_1 = require("zod");
// User change-password (self) - must provide current password
exports.changePasswordSchema = zod_1.z.object({
    oldPassword: zod_1.z.string().min(1, 'Current password is required'),
    newPassword: zod_1.z
        .string()
        .min(10, 'Password must be at least 10 characters')
        .max(72, 'Password must not exceed 72 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[!@#$%^&*()\-_=+\[\]{}|;:,.<>?]/, 'Password must contain at least one special character'),
});
// Admin reset password - no body required; server will generate a temporary password
exports.adminResetPasswordSchema = zod_1.z.object({});
exports.default = {
    changePasswordSchema: exports.changePasswordSchema,
    adminResetPasswordSchema: exports.adminResetPasswordSchema,
};
