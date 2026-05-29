import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import UsersService from '../service/users.service';
import type { CreateUserDto, UpdateUserDto } from '../dto';
import type { ChangePasswordDto } from '../dto/change-password.dto';

/**
 * Users Controller - Handles user account operations
 */

/**
 * GET /api/v1/users
 * List all users with role-based filtering and pagination
 */
export async function getUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const role = req.query.role as string;
    const status = req.query.status as string;

    const userRole = (req as any).userRole as UserRole;

    const result = await UsersService.getUsers({
      page,
      limit,
      search,
      role: role as any,
      status: status as any,
      userRole,
    });

    res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/users/:id
 * Get user by ID
 */
export async function getUserById(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = parseInt(req.params.id as string);

    const user = await UsersService.getUserById(userId);

    res.status(200).json({
      success: true,
      message: 'User retrieved successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/users
 * Create new user account
 */
export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const dto: CreateUserDto = req.body;
    const role = dto.role as UserRole;

    const result = await UsersService.createUser(dto, role);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: result.user ?? result,
      temporaryPassword: result.temporaryPassword ?? undefined,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/users/change-password
 * Change password for current user
 */
export async function changeMyPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as number;
    const dto: ChangePasswordDto = req.body;

    await UsersService.changePassword(userId, dto.oldPassword, dto.newPassword);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/users/:id/reset-password
 * Admin resets a user's password; server returns a temporary password
 */
export async function resetUserPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const targetUserId = parseInt(req.params.id as string);

    const result = await UsersService.resetPassword(targetUserId);

    res.status(200).json({
      success: true,
      message: 'Password reset successfully',
      data: result.user,
      temporaryPassword: result.temporaryPassword,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/users/:id
 * Update user details
 */
export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = parseInt(req.params.id as string);
    const dto: UpdateUserDto = req.body;

    const user = await UsersService.updateUser(userId, dto);

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/users/:id
 * Soft-delete (deactivate) user account
 */
export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = parseInt(req.params.id as string);

    const user = await UsersService.deleteUser(userId);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/users/:id/deactivate
 * Deactivate user account
 */
export async function deactivateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = parseInt(req.params.id as string);

    const user = await UsersService.deactivateUser(userId);

    res.status(200).json({
      success: true,
      message: 'User deactivated successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/users/:id/activate
 * Reactivate user account
 */
export async function activateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = parseInt(req.params.id as string);

    const user = await UsersService.activateUser(userId);

    res.status(200).json({
      success: true,
      message: 'User activated successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/users/:id/approve
 * Approve a student so they can sign in
 */
export async function approveStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = parseInt(req.params.id as string);

    const user = await UsersService.approveStudent(userId);

    res.status(200).json({
      success: true,
      message: 'Student approved successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

export default {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  deactivateUser,
  activateUser,
};
