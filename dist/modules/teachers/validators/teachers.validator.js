"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.teachersValidator = exports.assignSubjectSchema = exports.updateTeacherSchema = exports.createTeacherSchema = void 0;
const zod_1 = require("zod");
exports.createTeacherSchema = zod_1.z.object({
    email: zod_1.z.string().email().max(255),
    password: zod_1.z.string().min(6).optional(),
    fullName: zod_1.z.string().min(2).max(200),
    nic: zod_1.z.string().min(6).max(20),
    gender: zod_1.z.enum(['MALE', 'FEMALE', 'OTHER']),
    address: zod_1.z.string().min(5).max(255),
    phone: zod_1.z.string().regex(/^\+?[0-9]{7,15}$/, 'Invalid phone format').optional(),
    subjectId: zod_1.z.string().uuid('subjectId must be a valid UUID').optional(),
    salary: zod_1.z.number().positive().optional(),
});
exports.updateTeacherSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(2).max(200).optional(),
    phone: zod_1.z.string().regex(/^\+?[0-9]{7,15}$/, 'Invalid phone format').optional(),
    address: zod_1.z.string().min(5).max(255).optional(),
    subjectId: zod_1.z.string().uuid('subjectId must be a valid UUID').optional(),
    salary: zod_1.z.number().positive().optional(),
    nic: zod_1.z.string().min(6).max(20).optional(),
    gender: zod_1.z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
});
exports.assignSubjectSchema = zod_1.z.object({
    subjectId: zod_1.z.string().uuid('subjectId must be a valid UUID'),
});
exports.teachersValidator = {
    createTeacherSchema: exports.createTeacherSchema,
    updateTeacherSchema: exports.updateTeacherSchema,
    assignSubjectSchema: exports.assignSubjectSchema,
};
