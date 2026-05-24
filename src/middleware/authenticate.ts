import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.util';
import { AppError } from '../utils/AppError';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }

    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken as string;
    }

    if (!token) {
      throw new AppError('Authentication required. Please log in.', 401);
    }

    req.user = verifyAccessToken(token);
    next();
  } catch (error) {
    next(error);
  }
}