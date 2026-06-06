import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { AppError } from '../utils/AppError';

export function authorize(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required.', 401));
      return;
    }

    if (!allowedRoles.includes(req.user.role as Role)) {
      next(new AppError(`Access denied. Required role(s): ${allowedRoles.join(', ')}.`, 403));
      return;
    }

    next();
  };
}

// Convenience middlewares for 4 roles
export const adminOnly       = authorize(Role.ADMIN);
export const adminOrManager  = authorize(Role.ADMIN, Role.MANAGER);
export const staffOnly       = authorize(Role.ADMIN, Role.MANAGER, Role.TEACHER);
export const teacherOnly     = authorize(Role.TEACHER);
export const studentOnly     = authorize(Role.STUDENT);