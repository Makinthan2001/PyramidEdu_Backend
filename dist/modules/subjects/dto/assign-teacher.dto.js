"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignTeacherSchema = void 0;
const zod_1 = require("zod");
exports.assignTeacherSchema = zod_1.z.object({
    teacherId: zod_1.z.number().int().positive('Teacher ID is required'),
});
exports.default = {
    assignTeacherSchema: exports.assignTeacherSchema,
};
