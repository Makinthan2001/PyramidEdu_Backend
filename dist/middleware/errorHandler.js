"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const AppError_1 = require("../utils/AppError");
function errorHandler(err, _req, res, _next) {
    var _a, _b, _c;
    const isDev = process.env.NODE_ENV !== 'production';
    if (err instanceof AppError_1.AppError && err.isOperational) {
        res.status(err.status).json(Object.assign({ success: false, message: err.message }, (isDev && { stack: err.stack })));
        return;
    }
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
            const field = (_c = (_b = (_a = err.meta) === null || _a === void 0 ? void 0 : _a.target) === null || _b === void 0 ? void 0 : _b.join(', ')) !== null && _c !== void 0 ? _c : 'field';
            res.status(409).json({
                success: false,
                message: `A record with this ${field} already exists.`,
            });
            return;
        }
        if (err.code === 'P2025') {
            res.status(404).json({
                success: false,
                message: 'Record not found.',
            });
            return;
        }
    }
    console.error('Unhandled Error:', err);
    res.status(500).json(Object.assign({ success: false, message: 'An unexpected error occurred. Please try again later.' }, (isDev && { stack: err === null || err === void 0 ? void 0 : err.stack })));
}
exports.default = errorHandler;
