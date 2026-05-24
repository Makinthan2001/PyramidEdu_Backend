// ============================================================
// src/middleware/errorHandler.ts  (updated)
// Centralized error handler — must be the LAST middleware in app.ts.
// Handles AppError (operational), Prisma errors, and unknown bugs.
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { Prisma } from '@prisma/client';

export default function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const isDev = process.env.NODE_ENV !== 'production';

  // ── 1. Operational / known errors (AppError) ─────────────
  if (err instanceof AppError && err.isOperational) {
    res.status(err.status).json({
      success: false,
      message: err.message,
      ...(isDev && { stack: err.stack }),
    });
    return;
  }

  // ── 2. Prisma unique-constraint violation ─────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const field = (err.meta?.target as string[])?.join(', ') ?? 'field';
      res.status(409).json({
        success: false,
        message: `A record with this ${field} already exists.`,
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ success: false, message: 'Record not found.' });
      return;
    }
  }

  // ── 3. Unknown / programming errors ──────────────────────
  console.error('Unhandled Error:', err);

  res.status(500).json({
    success: false,
    message: 'An unexpected error occurred. Please try again later.',
    ...(isDev && { stack: err?.stack }),
  });
}
