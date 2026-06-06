"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignTeacherSchema = void 0;
const zod_1 = require("zod");
exports.assignTeacherSchema = zod_1.z.object({
    teacherId: zod_1.z.string().uuid('Teacher ID must be a valid UUID'),
});
exports.default = {
    assignTeacherSchema: exports.assignTeacherSchema,
};
