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
    firstName: zod_1.z.string().min(1, 'First name is required'),
    lastName: zod_1.z.string().min(1, 'Last name is required'),
    dateOfBirth: zod_1.z.coerce.date().refine((date) => {
        const today = new Date();
        let age = today.getFullYear() - date.getFullYear();
        const monthDiff = today.getMonth() - date.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
            age--;
        }
        return age >= 16;
    }, 'Student must be at least 16 years old'),
    alExamBatch: zod_1.z.string().min(1, 'A/L exam batch is required'),
    batchId: zod_1.z.string().min(1, 'Batch ID is required'),
    gender: zod_1.z.enum(['MALE', 'FEMALE', 'OTHER']),
    phone: zod_1.z.string().regex(/^\d{10}$/, 'Phone number must be exactly 10 digits'),
    address: zod_1.z.string().min(1, 'Address is required'),
    school: zod_1.z.string().min(1, 'School is required'),
    email: emailField,
    nic: zod_1.z.string().optional().or(zod_1.z.literal('')),
    parentName: zod_1.z.string().min(1, 'Parent name is required'),
    parentRelation: zod_1.z.string().min(1, 'Parent relation is required'),
    parentEmail: zod_1.z.string().email('Invalid parent email address').optional().or(zod_1.z.literal('')),
    parentPhone: zod_1.z.string().regex(/^\d{10}$/, 'Parent phone number must be exactly 10 digits').optional().or(zod_1.z.literal('')),
    selectedStreamId: zod_1.z.string().uuid('Invalid stream ID'),
    selectedCourseIds: zod_1.z.array(zod_1.z.string().uuid()).min(1, 'Select at least one subject').max(3, 'Select no more than 3 subjects'),
    selectedTeacherIds: zod_1.z.record(zod_1.z.string(), zod_1.z.string().uuid()),
    paymentStatus: zod_1.z.string().optional(),
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
