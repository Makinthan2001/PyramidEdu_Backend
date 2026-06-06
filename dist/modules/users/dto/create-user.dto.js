"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdminSchema = exports.createStudentSchema = exports.createTeacherSchema = exports.createManagerSchema = void 0;
const zod_1 = require("zod");
// Email field used across DTOs
const emailField = zod_1.z
    .string()
    .email('Invalid email format')
    .max(255, 'Email must not exceed 255 characters');
// Manager DTO
exports.createManagerSchema = zod_1.z.object({
    role: zod_1.z.literal('MANAGER'),
    fullName: zod_1.z.string().min(1, 'Full name is required').max(255),
    nic: zod_1.z.string().min(10, 'NIC number is required').max(20),
    gender: zod_1.z.enum(['MALE', 'FEMALE', 'OTHER']),
    address: zod_1.z.string().min(3, 'Address is required').max(500),
    email: emailField,
    password: zod_1.z.string().min(1, 'Password is required').optional(),
    phone: zod_1.z.string().min(10, 'Phone number must be at least 10 digits'),
    salary: zod_1.z.number().positive('Salary must be positive').optional(),
});
// Teacher DTO
exports.createTeacherSchema = zod_1.z.object({
    role: zod_1.z.literal('TEACHER'),
    fullName: zod_1.z.string().min(1, 'Full name is required').max(255),
    nic: zod_1.z.string().min(10, 'NIC number is required').max(20),
    gender: zod_1.z.enum(['MALE', 'FEMALE', 'OTHER']),
    address: zod_1.z.string().min(3, 'Address is required').max(500),
    subjectId: zod_1.z.string().uuid('Subject ID must be a valid UUID').optional(),
    email: emailField,
    password: zod_1.z.string().min(1, 'Password is required').optional(),
    phone: zod_1.z.string().min(10, 'Phone number must be at least 10 digits'),
    salary: zod_1.z.number().positive('Salary must be positive').optional(),
});
// Student DTO
exports.createStudentSchema = zod_1.z.object({
    role: zod_1.z.literal('STUDENT'),
    fullName: zod_1.z.string().min(1, 'Full name is required').max(255),
    indexNumber: zod_1.z.string().min(1, 'Index number is required').max(255),
    dateOfBirth: zod_1.z.coerce.date(),
    address: zod_1.z.string().min(1, 'Address is required').max(500),
    email: emailField,
    password: zod_1.z.string().min(1, 'Password is required').optional(),
    phone: zod_1.z.string().min(10, 'Phone number must be at least 10 digits'),
    nic: zod_1.z.string().min(10).max(20).optional(),
    batch: zod_1.z.string().optional(),
});
// Admin DTO
exports.createAdminSchema = zod_1.z.object({
    role: zod_1.z.literal('ADMIN'),
    fullName: zod_1.z.string().min(1, 'Full name is required').max(255),
    email: emailField,
    password: zod_1.z.string().min(1, 'Password is required'),
    phone: zod_1.z.string().min(10).optional(),
    accessLevel: zod_1.z.number().int().min(1).default(1),
});
exports.default = {
    createManagerSchema: exports.createManagerSchema,
    createTeacherSchema: exports.createTeacherSchema,
    createStudentSchema: exports.createStudentSchema,
    createAdminSchema: exports.createAdminSchema,
};
