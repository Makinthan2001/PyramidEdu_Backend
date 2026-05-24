import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { AppError } from '../utils/AppError';

export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required.', 401));
      return;
    }

    if (!allowedRoles.includes(req.user.role as UserRole)) {
      next(new AppError(`Access denied. Required role(s): ${allowedRoles.join(', ')}.`, 403));
      return;
    }

    next();
  };
}

// Convenience middlewares for 4 roles
export const adminOnly       = authorize(UserRole.ADMIN);
export const adminOrManager  = authorize(UserRole.ADMIN, UserRole.MANAGER);
export const staffOnly       = authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER);
export const teacherOnly     = authorize(UserRole.TEACHER);
export const studentOnly     = authorize(UserRole.STUDENT);