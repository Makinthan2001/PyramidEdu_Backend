"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrollStudentSchema = void 0;
const zod_1 = require("zod");
exports.enrollStudentSchema = zod_1.z.object({
    studentId: zod_1.z.string().uuid().optional(),
    userId: zod_1.z.string().uuid().optional(),
});
exports.default = {
    enrollStudentSchema: exports.enrollStudentSchema,
};
