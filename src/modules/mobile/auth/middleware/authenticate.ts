import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { verifyAccessToken } from '../../../../utils/jwt.util';
import { AppError } from '../../../../utils/AppError';

export function authenticateMobileStudent(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required. Please log in.', 401);
    }

    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);

    if (payload.role !== Role.STUDENT) {
      throw new AppError('Access restricted to student accounts.', 403);
    }

    req.user = payload;
    next();
  } catch (error) {
    next(error);
  }
}

export default authenticateMobileStudent;