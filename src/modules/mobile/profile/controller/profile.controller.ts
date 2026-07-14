import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../../utils/AppError';
import * as authService from '../../auth/service/auth.service';
import UsersService from '../../../users/service/users.service';

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.sub;

    if (!userId) {
      throw new AppError('Authentication required. Please log in.', 401);
    }

    const studentProfile = await authService.getCurrentStudent(userId);

    res.status(200).json({
      success: true,
      message: 'Student profile retrieved successfully',
      data: studentProfile,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.sub;

    if (!userId) {
      throw new AppError('Authentication required. Please log in.', 401);
    }

    const dto = req.body;
    await UsersService.updateUser(userId, dto);
    
    // Retrieve fresh data from database after update
    const updatedProfile = await authService.getCurrentStudent(userId);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedProfile,
    });
  } catch (error) {
    next(error);
  }
}

export default {
  getProfile,
  updateProfile,
};
