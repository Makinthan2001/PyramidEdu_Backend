import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { AppError } from '../../../utils/AppError';
import prisma from '../../../config/prisma.config';

/**
 * Users Guards - Role-based access control for user operations
 */

/**
 * Check if user is trying to access their own profile
 */
export function isUserOwner(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).userId as string | undefined;
  const targetUserId = req.params.id as string;

  if (!userId) {
    return next(new AppError('User not authenticated.', 401));
  }

  if (userId !== targetUserId) {
    return next(
      new AppError(
        'You can only access your own profile. Admins have full access.',
        403
      )
    );
  }

  next();
}

/**
 * Check if user can access another user's profile
 * ADMIN: can access anyone
 * Others: can only access their own profile
 */
export function canAccessUser(req: Request, res: Response, next: NextFunction) {
  const userRole = (req as any).userRole as Role | undefined;
  const userId = (req as any).userId as string | undefined;
  const targetUserId = req.params.id as string;

  if (!userId || !userRole) {
    return next(new AppError('User not authenticated.', 401));
  }

  // ADMIN can access anyone
  if (userRole === Role.ADMIN) {
    return next();
  }

  // Others can only access their own profile
  if (userId !== targetUserId) {
    return next(
      new AppError('You can only access your own profile.', 403)
    );
  }

  next();
}

/**
 * Check if user can manage users (create, update, delete)
 * ADMIN: can manage all
 * MANAGER: can only manage STUDENT users
 * Others: forbidden
 */
export function canManageUsers(req: Request, res: Response, next: NextFunction) {
  const userRole = (req as any).userRole as Role | undefined;

  if (!userRole) {
    return next(new AppError('User not authenticated.', 401));
  }

  // ADMIN has full access
  if (userRole === Role.ADMIN) {
    return next();
  }

  // MANAGER can manage students
  if (userRole === Role.MANAGER) {
    const targetUserId = req.params.id as string;
    if (targetUserId) {
      prisma.user.findUnique({ where: { id: targetUserId }, select: { role: true } })
        .then((target) => {
          if (!target) {
            return next(new AppError('Target user not found.', 404));
          }
          if (target.role !== Role.STUDENT) {
            return next(new AppError('Managers can only manage student accounts.', 403));
          }
          return next();
        })
        .catch((err) => {
          console.error('Error fetching target user for permission check:', err);
          return next(new AppError('Unable to verify permissions at this time.', 500));
        });
      return;
    }

    // For non-targeted requests (e.g., listing), allow manager to proceed (service-level filters will apply)
    return next();
  }

  // Others cannot manage users
  return next(
    new AppError(
      'You do not have permission to manage users.',
      403
    )
  );
}

/**
 * Check if user can create a specific role
 * ADMIN: can create all roles
 * MANAGER: can only create STUDENT users
 * Others: forbidden
 */
export function canCreateRole(req: Request, res: Response, next: NextFunction) {
  const userRole = (req as any).userRole as Role | undefined;
  const targetRole = req.body.role as Role | undefined;

  if (!userRole) {
    return next(new AppError('User not authenticated.', 401));
  }

  // ADMIN can create all roles
  if (userRole === Role.ADMIN) {
    return next();
  }

  // MANAGER can only create STUDENT users
  if (userRole === Role.MANAGER && targetRole === Role.STUDENT) {
    return next();
  }

  // Others cannot create users
  return next(
    new AppError(
      `You cannot create users with role ${targetRole}. Only ADMIN can create all roles, MANAGER can only create STUDENT users.`,
      403
    )
  );
}

/**
 * Prevent self-deactivation by non-admin users
 */
export function preventSelfDeactivation(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).userId as string | undefined;
  const userRole = (req as any).userRole as Role | undefined;
  const targetUserId = req.params.id as string;

  if (!userId || !userRole) {
    return next(new AppError('User not authenticated.', 401));
  }

  // ADMIN can deactivate anyone including themselves
  if (userRole === Role.ADMIN) {
    return next();
  }

  // Non-admin users cannot deactivate themselves
  if (userId === targetUserId) {
    return next(
      new AppError(
        'You cannot deactivate your own account. Contact an administrator.',
        403
      )
    );
  }

  // Non-admin users can only deactivate users they manage
  return next();
}

export default {
  isUserOwner,
  canAccessUser,
  canManageUsers,
  canCreateRole,
  preventSelfDeactivation,
};
