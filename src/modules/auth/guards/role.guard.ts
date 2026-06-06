import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { AppError } from '../../../utils/AppError';

/**
 * Role Guard - Checks if user has required role
 */
export function roleGuard(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).userRole as Role | undefined;

    if (!userRole) {
      return next(new AppError('User role not found. Please authenticate first.', 401));
    }

    if (!allowedRoles.includes(userRole)) {
      return next(new AppError(
        `Insufficient permissions. Required roles: ${allowedRoles.join(', ')}`,
        403
      ));
    }

    next();
  };
}

/**
 * Admin Only Guard
 */
export function adminOnly(req: Request, res: Response, next: NextFunction) {
  const userRole = (req as any).userRole as Role | undefined;

  if (!userRole) {
    return next(new AppError('User role not found. Please authenticate first.', 401));
  }

  if (userRole !== Role.ADMIN) {
    return next(new AppError('Only administrators can access this resource.', 403));
  }

  next();
}

/**
 * Manager or Admin Guard
 */
export function managerOrAdmin(req: Request, res: Response, next: NextFunction) {
  const userRole = (req as any).userRole as Role | undefined;

  if (!userRole) {
    return next(new AppError('User role not found. Please authenticate first.', 401));
  }

  const allowedForManagerOrAdmin: Role[] = [Role.ADMIN, Role.MANAGER];
  if (!allowedForManagerOrAdmin.includes(userRole)) {
    return next(new AppError('Only managers and administrators can access this resource.', 403));
  }

  next();
}

export default roleGuard;
