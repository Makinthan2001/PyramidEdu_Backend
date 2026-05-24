// ============================================================
// src/middleware/authenticate.ts
// Protects routes by verifying the JWT access token.
//
// Reads the token from:
//   1. Authorization header: "Bearer <token>"   (preferred for APIs)
//   2. httpOnly cookie named "accessToken"       (fallback for browser clients)
//
// On success → decoded payload is attached as req.user, next() is called.
// On failure → throws 401 AppError caught by the global error handler.
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.util';
import { AppError } from '../utils/AppError';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    // 1. Try Authorization header first
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7); // strip "Bearer "
    }

    // 2. Fall back to httpOnly cookie
    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken as string;
    }

    if (!token) {
      throw new AppError('Authentication required. Please log in.', 401);
    }

    // Verify and decode — throws AppError internally on failure
    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    next(err);
  }
}
