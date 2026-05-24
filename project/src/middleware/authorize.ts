// ============================================================
// src/middleware/authorize.ts
// Role-based access control (RBAC) middleware.
// Always used AFTER authenticate() because it reads req.user.
//
// Usage examples:
//   router.get('/admin-only', authenticate, authorize('ADMIN'), handler)
//   router.get('/staff',      authenticate, authorize('ADMIN', 'MANAGER'), handler)
//   router.get('/all-roles',  authenticate, authorize('ADMIN','MANAGER','TEACHER'), handler)
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { AppError } from '../utils/AppError';

/**
 * authorize(...roles)
 * Returns middleware that checks whether the authenticated user's role
 * is in the list of allowed roles.
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // req.user is populated by authenticate() — if missing, auth wasn't run
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }

    if (!allowedRoles.includes(req.user.role as UserRole)) {
      return next(
        new AppError(
          `Access denied. Required role(s): ${allowedRoles.join(', ')}.`,
          403,
        ),
      );
    }

    next();
  };
}

// ─── Convenience shortcuts ────────────────────────────────────
// Import these directly for cleaner route files.

/** Only ADMIN can access */
export const adminOnly = authorize(UserRole.ADMIN);

/** ADMIN or MANAGER can access */
export const adminOrManager = authorize(UserRole.ADMIN, UserRole.MANAGER);

/** Any staff role (ADMIN, MANAGER, TEACHER) can access */
export const staffOnly = authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER);
