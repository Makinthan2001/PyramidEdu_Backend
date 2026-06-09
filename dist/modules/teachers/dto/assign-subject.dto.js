"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignSubjectSchema = void 0;
const zod_1 = require("zod");
exports.assignSubjectSchema = zod_1.z.object({
    subjectId: zod_1.z.string().uuid('subjectId must be a valid UUID'),
});
