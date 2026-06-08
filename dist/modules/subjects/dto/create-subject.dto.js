"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSubjectSchema = void 0;
const zod_1 = require("zod");
const feeAmountSchema = zod_1.z
    .number()
    .positive('Fee amount must be a positive number')
    .refine((value) => Number.isInteger(value * 100), {
    message: 'Fee amount can have at most 2 decimal places',
});
exports.createSubjectSchema = zod_1.z.object({
    subjectName: zod_1.z.string().trim().min(2, 'Subject name must be at least 2 characters').max(100),
    subjectCode: zod_1.z
        .string()
        .trim()
        .min(1, 'Subject code is required')
        .max(20, 'Subject code must not exceed 20 characters')
        .optional(),
    feeAmount: feeAmountSchema,
    // Accept either an array of stream IDs (preferred) or a single streamId (backwards compat)
    streamIds: zod_1.z.array(zod_1.z.string().uuid()).min(1, 'At least one stream is required').optional(),
    streamId: zod_1.z.string().uuid('Stream ID must be a valid UUID').optional(),
    isActive: zod_1.z.boolean().optional(),
}).refine((data) => { var _a; return ((_a = data.streamIds) === null || _a === void 0 ? void 0 : _a.length) || data.streamId; }, {
    message: 'At least one stream must be provided',
    path: ['streamIds'],
});
exports.default = {
    createSubjectSchema: exports.createSubjectSchema,
};
