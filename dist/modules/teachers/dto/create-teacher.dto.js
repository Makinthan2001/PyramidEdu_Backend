"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTeacherSchema = void 0;
const zod_1 = require("zod");
exports.createTeacherSchema = zod_1.z.object({
    email: zod_1.z.string().email().max(255),
    password: zod_1.z.string().min(6).optional(), // hashed later
    firstName: zod_1.z.string().min(2).max(100),
    lastName: zod_1.z.string().min(2).max(100),
    nicNumber: zod_1.z.string().min(6).max(20),
    gender: zod_1.z.enum(['MALE', 'FEMALE', 'OTHER']),
    address: zod_1.z.string().min(5).max(255),
    phone: zod_1.z.string().regex(/^\+?[0-9]{7,15}$/, 'Invalid phone format').optional(),
    specialization: zod_1.z.string().min(2).max(100).optional(),
    salary: zod_1.z.number().positive().optional(),
});
