"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserSchema = void 0;
const zod_1 = require("zod");
const emailField = zod_1.z
    .string()
    .email('Invalid email format')
    .max(255, 'Email must not exceed 255 characters')
    .optional();
// Update user DTO - flexible for all role types
exports.updateUserSchema = zod_1.z.object({
    // Common optional fields
    email: emailField,
    phoneNumber: zod_1.z.string().min(10, 'Phone number must be at least 10 digits').optional(),
    // Name fields
    fullName: zod_1.z.string().min(1).max(255).optional(),
    firstName: zod_1.z.string().min(1).max(255).optional(),
    lastName: zod_1.z.string().min(1).max(255).optional(),
    // Identification & Demographic
    nicNumber: zod_1.z.string().min(1).max(20).optional(),
    gender: zod_1.z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
    address: zod_1.z.string().min(1).max(500).optional(),
    // Role-specific fields
    subject: zod_1.z.string().min(1).max(255).optional(),
    indexNumber: zod_1.z.string().min(1).max(255).optional(),
    parentName: zod_1.z.string().min(1).max(255).optional(),
    parentPhone: zod_1.z.string().min(10).optional(),
    roleType: zod_1.z.string().min(1).max(255).optional(),
    // Salary
    salary: zod_1.z.number().positive('Salary must be positive').optional(),
    // Profile Image URL
    profileImage: zod_1.z.string().url('Invalid URL format').or(zod_1.z.string().min(1)).optional(),
});
exports.default = {
    updateUserSchema: exports.updateUserSchema,
};
