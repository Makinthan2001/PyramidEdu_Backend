"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resendOtpSchema = exports.verifyOtpSchema = exports.initiateRegistrationSchema = void 0;
const zod_1 = require("zod");
exports.initiateRegistrationSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1, 'First name is required'),
    lastName: zod_1.z.string().min(1, 'Last name is required'),
    dateOfBirth: zod_1.z.string().min(1, 'Date of birth is required').refine((dob) => {
        const date = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - date.getFullYear();
        const monthDiff = today.getMonth() - date.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
            age--;
        }
        return age >= 16;
    }, 'Student must be at least 16 years old'),
    alExamBatch: zod_1.z.string().min(1, 'A/L exam batch is required'),
    batchId: zod_1.z.string().optional(),
    gender: zod_1.z.enum(['MALE', 'FEMALE', 'OTHER']),
    phone: zod_1.z.string().regex(/^\d{10}$/, 'Phone number must be exactly 10 digits'),
    address: zod_1.z.string().min(1, 'Address is required'),
    school: zod_1.z.string().min(1, 'School is required'),
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
    nic: zod_1.z.string().optional(),
    parentName: zod_1.z.string().min(1, 'Parent name is required'),
    parentRelation: zod_1.z.string().min(1, 'Parent relation is required'),
    parentEmail: zod_1.z.string().email('Invalid parent email address').optional().or(zod_1.z.literal('')),
    parentPhone: zod_1.z.string().regex(/^\d{10}$/, 'Parent phone number must be exactly 10 digits').optional().or(zod_1.z.literal('')),
    selectedStreamId: zod_1.z.string().uuid('Invalid stream ID'),
    selectedCourseIds: zod_1.z.array(zod_1.z.string().uuid()).min(1, 'Select at least one subject').max(3, 'Select no more than 3 subjects'),
    selectedTeacherIds: zod_1.z.record(zod_1.z.string(), zod_1.z.string().uuid()),
});
exports.verifyOtpSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    otpCode: zod_1.z.string().length(6, 'OTP must be 6 digits'),
});
exports.resendOtpSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
});
