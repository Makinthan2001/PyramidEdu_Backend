"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSubjectSchema = void 0;
const zod_1 = require("zod");
const feePerMonthSchema = zod_1.z
    .number()
    .positive('Fee per month must be a positive number')
    .refine((value) => Number.isInteger(value * 100), {
    message: 'Fee per month can have at most 2 decimal places',
});
exports.updateSubjectSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2, 'Subject name must be at least 2 characters').max(100).optional(),
    code: zod_1.z
        .string()
        .trim()
        .min(1, 'Subject code is required')
        .max(20, 'Subject code must not exceed 20 characters')
        .regex(/^[a-zA-Z0-9]+$/, 'Subject code must be alphanumeric')
        .optional(),
    feePerMonth: feePerMonthSchema.optional(),
    description: zod_1.z.string().trim().max(500).nullable().optional(),
});
exports.default = {
    updateSubjectSchema: exports.updateSubjectSchema,
};
