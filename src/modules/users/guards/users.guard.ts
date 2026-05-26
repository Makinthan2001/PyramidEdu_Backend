import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { AppError } from '../../../utils/AppError';

/**
 * Users Guards - Role-based access control for user operations
 */

/**
 * Check if user is trying to access their own profile
 */
export function isUserOwner(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).userId as number | undefined;
  const targetUserId = parseInt(req.params.id as string);

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
  const userRole = (req as any).userRole as UserRole | undefined;
  const userId = (req as any).userId as number | undefined;
  const targetUserId = parseInt(req.params.id as string);

  if (!userId || !userRole) {
    return next(new AppError('User not authenticated.', 401));
  }

  // ADMIN can access anyone
  if (userRole === UserRole.ADMIN) {
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
  const userRole = (req as any).userRole as UserRole | undefined;

  if (!userRole) {
    return next(new AppError('User not authenticated.', 401));
  }

  // ADMIN has full access
  if (userRole === UserRole.ADMIN) {
    return next();
  }

  // MANAGER can manage students
  if (userRole === UserRole.MANAGER) {
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
  const userRole = (req as any).userRole as UserRole | undefined;
  const targetRole = req.body.role as UserRole | undefined;

  if (!userRole) {
    return next(new AppError('User not authenticated.', 401));
  }

  // ADMIN can create all roles
  if (userRole === UserRole.ADMIN) {
    return next();
  }

  // MANAGER can only create STUDENT users
  if (userRole === UserRole.MANAGER && targetRole === UserRole.STUDENT) {
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
  const userId = (req as any).userId as number | undefined;
  const userRole = (req as any).userRole as UserRole | undefined;
  const targetUserId = parseInt(req.params.id as string);

  if (!userId || !userRole) {
    return next(new AppError('User not authenticated.', 401));
  }

  // ADMIN can deactivate anyone including themselves
  if (userRole === UserRole.ADMIN) {
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
