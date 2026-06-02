"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.forgotPasswordSchema = void 0;
const zod_1 = require("zod");
const emailField = zod_1.z.string().email('Please provide a valid email address.');
exports.forgotPasswordSchema = zod_1.z.object({
    email: emailField,
});
