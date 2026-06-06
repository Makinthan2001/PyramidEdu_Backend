"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSubjectSchema = void 0;
const zod_1 = require("zod");
const feeAmountSchema = zod_1.z
    .number()
    .positive('Fee amount must be a positive number')
    .refine((value) => Number.isInteger(value * 100), {
    message: 'Fee amount can have at most 2 decimal places',
});
exports.updateSubjectSchema = zod_1.z.object({
    subjectName: zod_1.z.string().trim().min(2, 'Subject name must be at least 2 characters').max(100).optional(),
    subjectCode: zod_1.z
        .string()
        .trim()
        .min(1, 'Subject code is required')
        .max(20, 'Subject code must not exceed 20 characters')
        .optional(),
    feeAmount: feeAmountSchema.optional(),
    streamId: zod_1.z.string().uuid('Stream ID must be a valid UUID').optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.default = {
    updateSubjectSchema: exports.updateSubjectSchema,
};
