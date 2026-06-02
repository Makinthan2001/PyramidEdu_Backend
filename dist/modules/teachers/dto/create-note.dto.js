"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNoteSchema = void 0;
const zod_1 = require("zod");
exports.createNoteSchema = zod_1.z.object({
    subjectId: zod_1.z.number().int().positive('subjectId must be a positive integer'),
    title: zod_1.z.string().min(2).max(255),
    fileUrl: zod_1.z.string().url(),
});
