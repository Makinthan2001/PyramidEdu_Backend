"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.teachersValidator = exports.assignSubjectSchema = exports.updateTeacherSchema = exports.createTeacherSchema = void 0;
const zod_1 = require("zod");
exports.createTeacherSchema = zod_1.z.object({
    email: zod_1.z.string().email().max(255),
    password: zod_1.z.string().min(6).optional(), // will be hashed later
    firstName: zod_1.z.string().min(2).max(100),
    lastName: zod_1.z.string().min(2).max(100),
    nicNumber: zod_1.z.string().min(6).max(20),
    gender: zod_1.z.enum(['MALE', 'FEMALE', 'OTHER']),
    address: zod_1.z.string().min(5).max(255),
    phone: zod_1.z.string().regex(/^\+?[0-9]{7,15}$/, 'Invalid phone format').optional(),
    specialization: zod_1.z.string().min(2).max(100).optional(),
    salary: zod_1.z.number().positive().optional(),
});
exports.updateTeacherSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(2).max(100).optional(),
    lastName: zod_1.z.string().min(2).max(100).optional(),
    phone: zod_1.z.string().regex(/^\+?[0-9]{7,15}$/, 'Invalid phone format').optional(),
    address: zod_1.z.string().min(5).max(255).optional(),
    specialization: zod_1.z.string().min(2).max(100).optional(),
    salary: zod_1.z.number().positive().optional(),
});
exports.assignSubjectSchema = zod_1.z.object({
    subjectId: zod_1.z.number().int().positive('subjectId must be a positive integer'),
});
// Optional convenience export
exports.teachersValidator = {
    createTeacherSchema: exports.createTeacherSchema,
    updateTeacherSchema: exports.updateTeacherSchema,
    assignSubjectSchema: exports.assignSubjectSchema,
};
