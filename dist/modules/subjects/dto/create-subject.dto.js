"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSubjectSchema = void 0;
const zod_1 = require("zod");
const feePerMonthSchema = zod_1.z
    .number()
    .positive('Fee per month must be a positive number')
    .refine((value) => Number.isInteger(value * 100), {
    message: 'Fee per month can have at most 2 decimal places',
});
exports.createSubjectSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2, 'Subject name must be at least 2 characters').max(100),
    code: zod_1.z
        .string()
        .trim()
        .min(1, 'Subject code is required')
        .max(20, 'Subject code must not exceed 20 characters')
        .regex(/^[a-zA-Z0-9]+$/, 'Subject code must be alphanumeric')
        .optional(),
    feePerMonth: feePerMonthSchema,
    streamIds: zod_1.z.array(zod_1.z.number().int().positive()).min(1, 'At least one stream is required'),
    isActive: zod_1.z.boolean().optional(),
    description: zod_1.z.string().trim().max(500).optional(),
});
exports.default = {
    createSubjectSchema: exports.createSubjectSchema,
};
