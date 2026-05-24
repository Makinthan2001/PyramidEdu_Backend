// ============================================================
// src/utils/jwt.util.ts
// All JWT operations live here: generate, verify, and decode.
// Uses jsonwebtoken under the hood with secrets from env vars.
//
// Access  token → short-lived (15 min), carries user identity
// Refresh token → long-lived  (7 days),  used to get new access tokens
// Reset   token → very short  (15 min),  one-time password-reset link
// ============================================================

import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import { AppError } from './AppError';
import type {
  JwtAccessPayload,
  JwtRefreshPayload,
  PasswordResetPayload,
} from '../types/auth.types';

// ─── Read secrets from environment ───────────────────────────
const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET  as string;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;
const RESET_SECRET   = process.env.JWT_RESET_SECRET   as string;

const ACCESS_EXPIRES  = process.env.JWT_ACCESS_EXPIRES_IN  || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const RESET_EXPIRES   = process.env.JWT_RESET_EXPIRES_IN   || '15m';

// Guard: crash early in dev if secrets are missing
function requireSecret(secret: string | undefined, name: string): string {
  if (!secret) throw new Error(`Missing environment variable: ${name}`);
  return secret;
}

// ─── Access Token ─────────────────────────────────────────────
/**
 * Signs a short-lived access token embedding userId, email, and role.
 * This token is sent with every API request in the Authorization header.
 */
export function generateAccessToken(payload: Omit<JwtAccessPayload, 'iat' | 'exp'>): string {
  const secret = requireSecret(ACCESS_SECRET, 'JWT_ACCESS_SECRET');
  return jwt.sign(payload, secret, { expiresIn: ACCESS_EXPIRES } as SignOptions);
}

/**
 * Verifies and decodes an access token.
 * Throws 401 AppError if the token is invalid or expired.
 */
export function verifyAccessToken(token: string): JwtAccessPayload {
  try {
    const secret = requireSecret(ACCESS_SECRET, 'JWT_ACCESS_SECRET');
    return jwt.verify(token, secret) as JwtAccessPayload;
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Access token has expired. Please refresh.', 401);
    }
    throw new AppError('Invalid access token.', 401);
  }
}

// ─── Refresh Token ────────────────────────────────────────────
/**
 * Signs a long-lived refresh token.
 * tokenFamily allows us to detect refresh-token reuse (rotation security).
 */
export function generateRefreshToken(
  userId: number,
  tokenFamily: string,
): string {
  const secret = requireSecret(REFRESH_SECRET, 'JWT_REFRESH_SECRET');
  const payload: Omit<JwtRefreshPayload, 'iat' | 'exp'> = {
    sub: userId,
    tokenFamily,
  };
  return jwt.sign(payload, secret, { expiresIn: REFRESH_EXPIRES } as SignOptions);
}

/**
 * Verifies and decodes a refresh token.
 * Throws 401 AppError if invalid or expired.
 */
export function verifyRefreshToken(token: string): JwtRefreshPayload {
  try {
    const secret = requireSecret(REFRESH_SECRET, 'JWT_REFRESH_SECRET');
    return jwt.verify(token, secret) as JwtRefreshPayload;
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Refresh token has expired. Please log in again.', 401);
    }
    throw new AppError('Invalid refresh token.', 401);
  }
}

// ─── Password Reset Token ─────────────────────────────────────
/**
 * Signs a short-lived one-time token for password resets.
 * Never re-usable after the password changes (old hash won't match).
 */
export function generateResetToken(userId: number): string {
  const secret = requireSecret(RESET_SECRET, 'JWT_RESET_SECRET');
  const payload: Omit<PasswordResetPayload, 'iat' | 'exp'> = {
    sub: userId,
    purpose: 'password_reset',
  };
  return jwt.sign(payload, secret, { expiresIn: RESET_EXPIRES } as SignOptions);
}

/**
 * Verifies a password-reset token.
 * Throws 400 if invalid or expired (not 401, since it's a reset flow).
 */
export function verifyResetToken(token: string): PasswordResetPayload {
  try {
    const secret = requireSecret(RESET_SECRET, 'JWT_RESET_SECRET');
    const payload = jwt.verify(token, secret) as PasswordResetPayload;
    if (payload.purpose !== 'password_reset') {
      throw new AppError('Token is not a password-reset token.', 400);
    }
    return payload;
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Password-reset link has expired. Please request a new one.', 400);
    }
    throw new AppError('Invalid password-reset token.', 400);
  }
}

// ─── Helper: ms string → Date ─────────────────────────────────
/**
 * Converts a JWT expiry string like "7d" or "15m" into a future Date.
 * Used when storing refresh-token expiry in the database.
 */
export function expiryStringToDate(expiry: string): Date {
  const unit  = expiry.slice(-1);           // 'd', 'm', 'h', 's'
  const value = parseInt(expiry.slice(0, -1), 10);
  const ms: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return new Date(Date.now() + (ms[unit] ?? 0) * value);
}
