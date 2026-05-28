import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../../utils/AppError';
import * as authService from '../service/auth.service';
import type { LoginDto } from '../dto/login.dto';
import type { RefreshTokenDto, LogoutDto } from '../dto/token.dto';

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = req.body as LoginDto;
    const { student, tokens } = await authService.loginStudent(dto);

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        student,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function refreshToken(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = req.body as RefreshTokenDto;
    const tokens = await authService.refreshAccessToken(dto.refreshToken);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully.',
      data: tokens,
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = req.body as LogoutDto;
    await authService.logoutStudent(dto.refreshToken, dto.logoutAll ?? false);

    res.status(200).json({
      success: true,
      message: dto.logoutAll ? 'Logged out from all devices.' : 'Logged out successfully.',
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.sub;

    if (!userId) {
      throw new AppError('Authentication required. Please log in.', 401);
    }

    const student = await authService.getCurrentStudent(userId);

    res.status(200).json({
      success: true,
      data: { student },
    });
  } catch (error) {
    next(error);
  }
}

export default {
  login,
  refreshToken,
  logout,
  getMe,
};