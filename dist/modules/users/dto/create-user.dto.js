"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdminSchema = exports.createStudentSchema = exports.createSupportStaffSchema = exports.createTeacherSchema = exports.createManagerSchema = void 0;
const zod_1 = require("zod");
// Email field used across DTOs
const emailField = zod_1.z
    .string()
    .email('Invalid email format')
    .max(255, 'Email must not exceed 255 characters');
// Manager DTO
exports.createManagerSchema = zod_1.z.object({
    role: zod_1.z.literal('MANAGER'),
    firstName: zod_1.z.string().min(1, 'First name is required').max(255),
    lastName: zod_1.z.string().min(1, 'Last name is required').max(255),
    nicNumber: zod_1.z.string().min(10, 'NIC number is required').max(20),
    gender: zod_1.z.enum(['MALE', 'FEMALE', 'OTHER']),
    address: zod_1.z.string().min(3, 'Address is required').max(500),
    email: emailField,
    phoneNumber: zod_1.z.string().min(10, 'Phone number must be at least 10 digits'),
    salary: zod_1.z.number().positive('Salary must be positive').optional(),
});
// Teacher DTO
exports.createTeacherSchema = zod_1.z.object({
    role: zod_1.z.literal('TEACHER'),
    firstName: zod_1.z.string().min(1, 'First name is required').max(255),
    lastName: zod_1.z.string().min(1, 'Last name is required').max(255),
    nicNumber: zod_1.z.string().min(10, 'NIC number is required').max(20),
    gender: zod_1.z.enum(['MALE', 'FEMALE', 'OTHER']),
    address: zod_1.z.string().min(3, 'Address is required').max(500),
    subject: zod_1.z.string().min(1, 'Subject is required').max(255),
    email: emailField,
    phoneNumber: zod_1.z.string().min(10, 'Phone number must be at least 10 digits'),
    salary: zod_1.z.number().positive('Salary must be positive').optional(),
});
// Support Staff DTO
exports.createSupportStaffSchema = zod_1.z.object({
    role: zod_1.z.literal('SUPPORT_STAFF'),
    firstName: zod_1.z.string().min(1, 'First name is required').max(255),
    lastName: zod_1.z.string().min(1, 'Last name is required').max(255),
    nicNumber: zod_1.z.string().min(1, 'NIC number is required').max(20),
    gender: zod_1.z.enum(['MALE', 'FEMALE', 'OTHER']),
    address: zod_1.z.string().min(1, 'Address is required').max(500),
    roleType: zod_1.z.string().min(1, 'Role is required').max(255),
    email: emailField,
    phoneNumber: zod_1.z.string().min(10, 'Phone number must be at least 10 digits'),
    salary: zod_1.z.number().positive('Salary must be positive').optional(),
});
// Student DTO
exports.createStudentSchema = zod_1.z.object({
    role: zod_1.z.literal('STUDENT'),
    firstName: zod_1.z.string().min(1, 'First name is required').max(255),
    lastName: zod_1.z.string().min(1, 'Last name is required').max(255),
    indexNumber: zod_1.z.string().min(1, 'Index number is required').max(255),
    parentName: zod_1.z.string().min(1, 'Parent name is required').max(255),
    parentPhone: zod_1.z.string().min(10, 'Parent phone must be at least 10 digits'),
    address: zod_1.z.string().min(1, 'Address is required').max(500),
    email: emailField,
    phoneNumber: zod_1.z.string().min(10, 'Phone number must be at least 10 digits'),
});
// Admin can create any role - flexible schema
exports.createAdminSchema = zod_1.z.object({
    role: zod_1.z.enum(['ADMIN', 'MANAGER', 'TEACHER', 'STUDENT', 'SUPPORT_STAFF']),
    // Common fields
    email: emailField,
    // Manager fields
    firstName: zod_1.z.string().max(255).optional(),
    lastName: zod_1.z.string().max(255).optional(),
    nicNumber: zod_1.z.string().max(20).optional(),
    gender: zod_1.z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
    address: zod_1.z.string().max(500).optional(),
    salary: zod_1.z.number().positive().optional(),
    // Teacher fields
    subject: zod_1.z.string().max(255).optional(),
    // Student fields
    indexNumber: zod_1.z.string().max(255).optional(),
    parentName: zod_1.z.string().max(255).optional(),
    parentPhone: zod_1.z.string().optional(),
    // Support Staff fields
    roleType: zod_1.z.string().max(255).optional(),
    // Common optional
    phoneNumber: zod_1.z.string().min(10).optional(),
});
exports.default = {
    createManagerSchema: exports.createManagerSchema,
    createTeacherSchema: exports.createTeacherSchema,
    createSupportStaffSchema: exports.createSupportStaffSchema,
    createStudentSchema: exports.createStudentSchema,
    createAdminSchema: exports.createAdminSchema,
};
