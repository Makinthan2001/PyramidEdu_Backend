"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logoutSchema = exports.refreshTokenSchema = void 0;
const zod_1 = require("zod");
exports.refreshTokenSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1, 'Refresh token is required.'),
});
exports.logoutSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1, 'Refresh token is required.'),
    logoutAll: zod_1.z.boolean().optional().default(false),
});
