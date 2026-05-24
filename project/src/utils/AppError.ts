// ============================================================
// src/utils/AppError.ts
// A typed error class that carries an HTTP status code.
// Throw this anywhere; the global errorHandler will catch it
// and send the right HTTP response automatically.
// ============================================================

export class AppError extends Error {
  public readonly status: number;
  public readonly isOperational: boolean;

  constructor(message: string, status: number = 500) {
    super(message);
    this.status = status;
    this.isOperational = true; // distinguishes expected errors from bugs

    // Restore prototype chain (required when extending built-in classes in TS)
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── Convenience factories ────────────────────────────────────
export const BadRequest      = (msg: string) => new AppError(msg, 400);
export const Unauthorized    = (msg: string) => new AppError(msg, 401);
export const Forbidden       = (msg: string) => new AppError(msg, 403);
export const NotFound        = (msg: string) => new AppError(msg, 404);
export const Conflict        = (msg: string) => new AppError(msg, 409);
export const InternalError   = (msg: string) => new AppError(msg, 500);
