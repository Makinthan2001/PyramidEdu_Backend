import jwt, { SignOptions } from 'jsonwebtoken';
import { AppError } from './AppError';
import type { JwtAccessPayload, JwtRefreshPayload, PasswordResetPayload } from '../types/auth.types';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET as string;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;
const RESET_SECRET = process.env.JWT_RESET_SECRET as string;

const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const RESET_EXPIRES = process.env.JWT_RESET_EXPIRES_IN || '15m';

function requireSecret(secret: string | undefined, name: string): string {
  if (!secret) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return secret;
}

export function generateAccessToken(
  payload: Omit<JwtAccessPayload, 'iat' | 'exp'>,
  expiresIn: string = ACCESS_EXPIRES,
): string {
  return jwt.sign(payload, requireSecret(ACCESS_SECRET, 'JWT_ACCESS_SECRET'), {
    expiresIn,
  } as SignOptions);
}

export function verifyAccessToken(token: string): JwtAccessPayload {
  try {
    return jwt.verify(token, requireSecret(ACCESS_SECRET, 'JWT_ACCESS_SECRET')) as unknown as JwtAccessPayload;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Access token has expired. Please refresh.', 401);
    }
    throw new AppError('Invalid access token.', 401);
  }
}

export function generateRefreshToken(userId: number, tokenFamily: string, expiresIn: string = REFRESH_EXPIRES): string {
  return jwt.sign(
    { sub: userId, tokenFamily } satisfies Omit<JwtRefreshPayload, 'iat' | 'exp'>,
    requireSecret(REFRESH_SECRET, 'JWT_REFRESH_SECRET'),
    { expiresIn } as SignOptions,
  );
}

export function verifyRefreshToken(token: string): JwtRefreshPayload {
  try {
    return jwt.verify(token, requireSecret(REFRESH_SECRET, 'JWT_REFRESH_SECRET')) as unknown as JwtRefreshPayload;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Refresh token has expired. Please log in again.', 401);
    }
    throw new AppError('Invalid refresh token.', 401);
  }
}

export function generateResetToken(userId: number): string {
  return jwt.sign(
    { sub: userId, purpose: 'password_reset' } satisfies Omit<PasswordResetPayload, 'iat' | 'exp'>,
    requireSecret(RESET_SECRET, 'JWT_RESET_SECRET'),
    { expiresIn: RESET_EXPIRES } as SignOptions,
  );
}

export function verifyResetToken(token: string): PasswordResetPayload {
  try {
    const payload = jwt.verify(token, requireSecret(RESET_SECRET, 'JWT_RESET_SECRET')) as unknown as PasswordResetPayload;
    if (payload.purpose !== 'password_reset') {
      throw new AppError('Token is not a password-reset token.', 400);
    }
    return payload;
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Password-reset link has expired. Please request a new one.', 400);
    }
    throw new AppError('Invalid password-reset token.', 400);
  }
}

export function expiryStringToDate(expiry: string): Date {
  const unit = expiry.slice(-1);
  const value = parseInt(expiry.slice(0, -1), 10);
  const milliseconds: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return new Date(Date.now() + (milliseconds[unit] ?? 0) * value);
}