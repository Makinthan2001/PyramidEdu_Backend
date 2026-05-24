// ============================================================
// src/modules/auth/controller/auth.controller.ts
// HTTP layer for authentication.
// Controllers are intentionally thin — they:
//   1. Extract data from req (body, cookies, user)
//   2. Call the service method
//   3. Set cookies / format response
//   4. Call next(err) on failure
//
// No business logic lives here.
// ============================================================

import { Request, Response, NextFunction } from 'express';
import * as authService from '../service/auth.service';
import type {
  RegisterDto,
  LoginDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from '../validators/auth.validator';
import { AppError } from '../../../utils/AppError';

// ─── Cookie config ────────────────────────────────────────────
// httpOnly: JS cannot read this cookie (XSS protection)
// secure:   only sent over HTTPS in production
// sameSite: CSRF protection
const REFRESH_COOKIE_OPTIONS = {
  httpOnly:  true,
  secure:    process.env.NODE_ENV === 'production',
  sameSite:  'strict' as const,
  maxAge:    7 * 24 * 60 * 60 * 1000, // 7 days in ms
  path:      '/api/auth',              // only sent to auth endpoints
};

// ─── POST /api/auth/register ──────────────────────────────────
export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = req.body as RegisterDto;
    const user = await authService.registerUser(dto);

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      data: { user },
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/auth/login ─────────────────────────────────────
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = req.body as LoginDto;
    const { user, tokens } = await authService.loginUser(dto);

    // Store refresh token in httpOnly cookie
    res.cookie('refreshToken', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        user,
        accessToken: tokens.accessToken,
        // refreshToken is in the cookie — don't expose it in JSON body
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/auth/refresh ───────────────────────────────────
export async function refreshToken(req: Request, res: Response, next: NextFunction) {
  try {
    // Read refresh token from httpOnly cookie
    const token = req.cookies?.refreshToken as string | undefined;

    if (!token) {
      throw new AppError('No refresh token provided. Please log in again.', 401);
    }

    const tokens = await authService.refreshAccessToken(token);

    // Rotate the cookie with the new refresh token
    res.cookie('refreshToken', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully.',
      data: { accessToken: tokens.accessToken },
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/auth/logout ────────────────────────────────────
export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const token    = req.cookies?.refreshToken as string | undefined;
    const logoutAll = req.query.all === 'true'; // ?all=true logs out all devices

    if (token) {
      await authService.logoutUser(token, logoutAll);
    }

    // Clear the cookie
    res.clearCookie('refreshToken', { path: '/api/auth' });

    res.status(200).json({
      success: true,
      message: logoutAll ? 'Logged out from all devices.' : 'Logged out successfully.',
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/auth/me ─────────────────────────────────────────
export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    // req.user is set by the authenticate middleware
    const userId = req.user!.sub;
    const user   = await authService.getCurrentUser(userId);

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /api/auth/change-password ─────────────────────────
export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.sub;
    const dto    = req.body as ChangePasswordDto;

    await authService.changePassword(userId, dto);

    // Clear refresh token cookie — user must log in again on other devices
    res.clearCookie('refreshToken', { path: '/api/auth' });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully. Please log in again.',
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/auth/forgot-password ──────────────────────────
export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const dto   = req.body as ForgotPasswordDto;
    const token = await authService.forgotPassword(dto);

    // Always respond with the same message to prevent email enumeration
    const responseData: Record<string, string> = {
      message: 'If an account with that email exists, a password-reset link has been sent.',
    };

    // In development only: expose the token for Postman testing
    if (process.env.NODE_ENV !== 'production' && token) {
      responseData.devResetToken = token;
    }

    res.status(200).json({ success: true, data: responseData });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/auth/reset-password ───────────────────────────
export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = req.body as ResetPasswordDto;
    await authService.resetPassword(dto);

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. Please log in with your new password.',
    });
  } catch (err) {
    next(err);
  }
}
