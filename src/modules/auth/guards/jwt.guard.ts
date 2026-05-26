import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../../../utils/jwt.util';
import { AppError } from '../../../utils/AppError';
import type { JwtAccessPayload } from '../../../types/auth.types';

/**
 * JWT Guard - Verifies JWT token and attaches user data to request
 */
export function jwtGuard(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('No authorization token provided.', 401));
    }

    const token = authHeader.slice(7);

    const payload = verifyAccessToken(token) as JwtAccessPayload;

    // Attach user data to request
    (req as any).user = payload;
    (req as any).userId = payload.sub;
    (req as any).userRole = payload.role;

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Invalid or expired token.', 401));
    }
  }
}

export default jwtGuard;
