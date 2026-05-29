"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginSchema = void 0;
const zod_1 = require("zod");
const emailField = zod_1.z.string().email('Please provide a valid email address.');
exports.loginSchema = zod_1.z.object({
    email: emailField,
    password: zod_1.z.string().min(1, 'Password is required.'),
});
