"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignTeacherSchema = void 0;
const zod_1 = require("zod");
exports.assignTeacherSchema = zod_1.z.object({
    teacherId: zod_1.z.string().uuid('Teacher ID must be a valid UUID'),
    batchIds: zod_1.z.array(zod_1.z.string().uuid('Invalid batch ID')).optional(),
});
exports.default = {
    assignTeacherSchema: exports.assignTeacherSchema,
};
