"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePasswordSchema = void 0;
const zod_1 = require("zod");
const passwordField = zod_1.z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(72, 'Password must be at most 72 characters.')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
    .regex(/[0-9]/, 'Password must contain at least one number.');
exports.changePasswordSchema = zod_1.z
    .object({
    currentPassword: zod_1.z.string().min(1, 'Current password is required.'),
    newPassword: passwordField,
    confirmPassword: zod_1.z.string().min(1, 'Please confirm your new password.'),
})
    .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'New password and confirmation do not match.',
    path: ['confirmPassword'],
})
    .refine((value) => value.currentPassword !== value.newPassword, {
    message: 'New password must differ from the current password.',
    path: ['newPassword'],
});
