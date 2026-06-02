"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTeacherSchema = void 0;
const zod_1 = require("zod");
exports.updateTeacherSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(2).max(100).optional(),
    lastName: zod_1.z.string().min(2).max(100).optional(),
    phone: zod_1.z.string().regex(/^\+?[0-9]{7,15}$/, 'Invalid phone format').optional(),
    address: zod_1.z.string().min(5).max(255).optional(),
    specialization: zod_1.z.string().min(2).max(100).optional(),
    salary: zod_1.z.number().positive().optional(),
});
