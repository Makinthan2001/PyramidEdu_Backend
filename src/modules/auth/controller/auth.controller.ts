import { Request, Response, NextFunction } from 'express';
import * as authService from '../service/auth.service';
import type { RegisterDto } from '../validators/auth.validator';
import type { LoginDto } from '../dto/login.dto';
import type { ChangePasswordDto } from '../dto/change-password.dto';
import type { ForgotPasswordDto } from '../dto/forgot-password.dto';
import type { ResetPasswordDto } from '../dto/reset-password.dto';
import { AppError } from '../../../utils/AppError';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  // Allow cross-site cookie usage in development (frontend on different origin)
  sameSite: process.env.NODE_ENV === 'production' ? ('strict' as const) : ('lax' as const),
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api',
};

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = req.body as RegisterDto;
    const user = await authService.registerUser(dto);

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = req.body as LoginDto;
    const { user, tokens } = await authService.loginUser(dto);

    res.cookie('refreshToken', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        user,
        student: user.role === 'STUDENT' ? user : undefined,
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
    const token = (req.cookies?.refreshToken || req.body?.refreshToken) as string | undefined;

    if (!token) {
      throw new AppError('No refresh token provided. Please log in again.', 401);
    }

    const tokens = await authService.refreshAccessToken(token);
    res.cookie('refreshToken', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully.',
      data: { 
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const token = (req.cookies?.refreshToken || req.body?.refreshToken) as string | undefined;
    const logoutAll = req.query.all === 'true';

    if (token) {
      await authService.logoutUser(token, logoutAll);
    }

    res.clearCookie('refreshToken', { path: '/api' });

    res.status(200).json({
      success: true,
      message: logoutAll ? 'Logged out from all devices.' : 'Logged out successfully.',
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.sub;
    const user = await authService.getCurrentUser(userId);

    res.status(200).json({
      success: true,
      data: { 
        user,
        student: user.role === 'STUDENT' ? user : undefined
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.sub;
    const dto = req.body as ChangePasswordDto;

    await authService.changePassword(userId, dto);

    res.clearCookie('refreshToken', { path: '/api' });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully. Please log in again.',
    });
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = req.body as ForgotPasswordDto;
    const token = await authService.forgotPassword(dto);

    const responseData: Record<string, string> = {
      message: 'If an account with that email exists, a password-reset link has been sent.',
    };

    if (process.env.NODE_ENV !== 'production' && token) {
      responseData.devResetToken = token;
    }

    res.status(200).json({ success: true, data: responseData });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = req.body as ResetPasswordDto;
    await authService.resetPassword(dto);

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. Please log in with your new password.',
    });
  } catch (error) {
    next(error);
  }
}