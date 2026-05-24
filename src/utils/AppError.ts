export class AppError extends Error {
  public readonly status: number;
  public readonly isOperational: boolean;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
    this.isOperational = true;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export const BadRequest = (message: string) => new AppError(message, 400);
export const Unauthorized = (message: string) => new AppError(message, 401);
export const Forbidden = (message: string) => new AppError(message, 403);
export const NotFound = (message: string) => new AppError(message, 404);
export const Conflict = (message: string) => new AppError(message, 409);
export const InternalError = (message: string) => new AppError(message, 500);