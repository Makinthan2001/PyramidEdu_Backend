"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStreamSchema = void 0;
const zod_1 = require("zod");
exports.createStreamSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2, 'Stream name must be at least 2 characters').max(120),
});
exports.default = {
    createStreamSchema: exports.createStreamSchema,
};
