"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalError = exports.Conflict = exports.NotFound = exports.Forbidden = exports.Unauthorized = exports.BadRequest = exports.AppError = void 0;
class AppError extends Error {
    constructor(message, status = 500) {
        super(message);
        this.status = status;
        this.isOperational = true;
        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
const BadRequest = (message) => new AppError(message, 400);
exports.BadRequest = BadRequest;
const Unauthorized = (message) => new AppError(message, 401);
exports.Unauthorized = Unauthorized;
const Forbidden = (message) => new AppError(message, 403);
exports.Forbidden = Forbidden;
const NotFound = (message) => new AppError(message, 404);
exports.NotFound = NotFound;
const Conflict = (message) => new AppError(message, 409);
exports.Conflict = Conflict;
const InternalError = (message) => new AppError(message, 500);
exports.InternalError = InternalError;
