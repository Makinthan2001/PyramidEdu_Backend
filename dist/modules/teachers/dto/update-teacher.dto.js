"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTeacherSchema = void 0;
const zod_1 = require("zod");
exports.updateTeacherSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(2).max(200).optional(),
    phone: zod_1.z.string().regex(/^\+?[0-9]{7,15}$/, 'Invalid phone format').optional(),
    address: zod_1.z.string().min(5).max(255).optional(),
    subjectId: zod_1.z.string().uuid('subjectId must be a valid UUID').optional(),
    salary: zod_1.z.number().positive().optional(),
    nic: zod_1.z.string().min(6).max(20).optional(),
    gender: zod_1.z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
});
