// ============================================================
// src/modules/auth/service/auth.service.ts
// The brain of the auth system. All business logic lives here.
// The controller is thin — it just calls these methods.
//
// Responsibilities:
//   • Register a new user
//   • Login and issue tokens
//   • Refresh access token (with rotation)
//   • Logout (revoke refresh token)
//   • Get current user
//   • Change password
//   • Forgot / reset password flow
// ============================================================

import { UserRole } from '@prisma/client';
import prisma from '../../../config/prisma.config';
import { hashPassword, comparePasswords } from '../../../utils/password.util';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateResetToken,
  verifyResetToken,
  expiryStringToDate,
} from '../../../utils/jwt.util';
import { generateTokenFamily, hashToken } from '../../../utils/crypto.util';
import { AppError } from '../../../utils/AppError';
import type {
  AuthTokens,
  LoginResult,
  SafeUser,
} from '../../../types/auth.types';
import type {
  RegisterDto,
  LoginDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from '../validators/auth.validator';

// ─── Internal helper ──────────────────────────────────────────
/** Strip sensitive fields before sending user to client */
function toSafeUser(user: {
  id: number;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
}): SafeUser {
  return {
    id:        user.id,
    email:     user.email,
    role:      user.role,
    isActive:  user.isActive,
    createdAt: user.createdAt,
  };
}

// ─── 1. REGISTER ─────────────────────────────────────────────
/**
 * Creates a new user account.
 * - Checks for duplicate email
 * - Hashes password with bcrypt (12 rounds)
 * - Saves user to DB
 * Returns the safe user object (no password hash).
 */
export async function registerUser(dto: RegisterDto): Promise<SafeUser> {
  // Check duplicate email
  const existing = await prisma.user.findUnique({ where: { email: dto.email } });
  if (existing) {
    throw new AppError('An account with this email already exists.', 409);
  }

  const passwordHash = await hashPassword(dto.password);

  const user = await prisma.user.create({
    data: {
      email:        dto.email,
      passwordHash: passwordHash,
      role:         dto.role,
    },
  });

  return toSafeUser(user);
}

// ─── 2. LOGIN ─────────────────────────────────────────────────
/**
 * Authenticates a user and issues a new access + refresh token pair.
 * - Verifies email exists and account is active
 * - Compares password with bcrypt
 * - Creates a refresh token with a new "token family" (for rotation)
 * - Stores hashed refresh token in DB
 */
export async function loginUser(dto: LoginDto): Promise<LoginResult> {
  // 1. Find user
  const user = await prisma.user.findUnique({ where: { email: dto.email } });
  if (!user) {
    // Use the same message for "not found" and "wrong password" — prevents email enumeration
    throw new AppError('Invalid email or password.', 401);
  }

  // 2. Check account is active
  if (!user.isActive) {
    throw new AppError('Your account has been deactivated. Please contact an administrator.', 403);
  }

  // 3. Verify password
  const isMatch = await comparePasswords(dto.password, user.passwordHash);
  if (!isMatch) {
    throw new AppError('Invalid email or password.', 401);
  }

  // 4. Generate tokens
  const tokenFamily  = generateTokenFamily(); // unique ID for this login session
  const accessToken  = generateAccessToken({ sub: user.id, email: user.email, role: user.role });
  const refreshToken = generateRefreshToken(user.id, tokenFamily);

  // 5. Store hashed refresh token in DB
  const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  await prisma.refreshToken.create({
    data: {
      userId:      user.id,
      tokenHash:   hashToken(refreshToken),
      tokenFamily: tokenFamily,
      expiresAt:   expiryStringToDate(REFRESH_EXPIRES),
    },
  });

  return {
    user:   toSafeUser(user),
    tokens: { accessToken, refreshToken },
  };
}

// ─── 3. REFRESH ACCESS TOKEN ──────────────────────────────────
/**
 * Issues a new access token from a valid refresh token.
 * Implements REFRESH TOKEN ROTATION:
 *   - Old refresh token is deleted
 *   - New refresh token is issued with same family
 *   - If family is already expired/missing → possible theft → revoke ALL tokens for user
 */
export async function refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
  // 1. Verify JWT signature and expiry
  const payload = verifyRefreshToken(refreshToken);

  // 2. Look up the hashed token in the DB
  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored) {
    // Token not in DB — either already used (reuse attack) or never issued.
    // Revoke all tokens for this user as a security measure.
    await prisma.refreshToken.deleteMany({ where: { userId: payload.sub } });
    throw new AppError('Refresh token reuse detected. All sessions have been terminated.', 401);
  }

  // 3. Check family matches (extra safety)
  if (stored.tokenFamily !== payload.tokenFamily) {
    await prisma.refreshToken.deleteMany({ where: { userId: payload.sub } });
    throw new AppError('Token family mismatch. Please log in again.', 401);
  }

  // 4. Check token hasn't expired in DB (belt-and-suspenders)
  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { tokenHash } });
    throw new AppError('Refresh token has expired. Please log in again.', 401);
  }

  // 5. Fetch fresh user (might have changed role / been deactivated)
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) {
    await prisma.refreshToken.deleteMany({ where: { userId: payload.sub } });
    throw new AppError('User not found or account deactivated.', 401);
  }

  // 6. Rotate: delete old token, issue new one with the same family
  await prisma.refreshToken.delete({ where: { tokenHash } });

  const newRefreshToken = generateRefreshToken(user.id, payload.tokenFamily);
  const newAccessToken  = generateAccessToken({ sub: user.id, email: user.email, role: user.role });

  const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  await prisma.refreshToken.create({
    data: {
      userId:      user.id,
      tokenHash:   hashToken(newRefreshToken),
      tokenFamily: payload.tokenFamily,
      expiresAt:   expiryStringToDate(REFRESH_EXPIRES),
    },
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

// ─── 4. LOGOUT ────────────────────────────────────────────────
/**
 * Revokes the provided refresh token (single session logout).
 * Pass `logoutAll = true` to revoke every session for the user.
 */
export async function logoutUser(
  refreshToken: string,
  logoutAll = false,
): Promise<void> {
  try {
    const payload = verifyRefreshToken(refreshToken);

    if (logoutAll) {
      // Revoke all sessions for this user
      await prisma.refreshToken.deleteMany({ where: { userId: payload.sub } });
    } else {
      // Revoke only this session
      const tokenHash = hashToken(refreshToken);
      await prisma.refreshToken.deleteMany({ where: { tokenHash } });
    }
  } catch {
    // Silently ignore — if the token is already invalid, logout is effectively done
  }
}

// ─── 5. GET CURRENT USER ──────────────────────────────────────
/**
 * Returns the authenticated user's profile.
 * Called from GET /auth/me — user id comes from req.user (JWT payload).
 */
export async function getCurrentUser(userId: number): Promise<SafeUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found.', 404);
  return toSafeUser(user);
}

// ─── 6. CHANGE PASSWORD ───────────────────────────────────────
/**
 * Changes the password for a logged-in user.
 * - Verifies current password before allowing change
 * - Hashes new password with bcrypt
 * - Revokes all refresh tokens (forces re-login on other devices)
 */
export async function changePassword(
  userId: number,
  dto: ChangePasswordDto,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found.', 404);

  // Verify current password
  const isMatch = await comparePasswords(dto.currentPassword, user.passwordHash);
  if (!isMatch) {
    throw new AppError('Current password is incorrect.', 400);
  }

  const newHash = await hashPassword(dto.newPassword);

  // Update password and revoke all sessions in one transaction
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data:  { passwordHash: newHash },
    }),
    prisma.refreshToken.deleteMany({ where: { userId } }),
  ]);
}

// ─── 7. FORGOT PASSWORD ───────────────────────────────────────
/**
 * Initiates the password-reset flow.
 * - Looks up the email
 * - Generates a short-lived reset token (JWT, 15 min)
 * - In production: send this token via email
 * - Returns the token so you can wire up your email service
 *
 * IMPORTANT: Always return a success message even if email not found
 * to prevent email enumeration attacks.
 */
export async function forgotPassword(dto: ForgotPasswordDto): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { email: dto.email } });

  if (!user || !user.isActive) {
    // Don't reveal whether the email exists
    return null;
  }

  const resetToken = generateResetToken(user.id);

  // TODO: send resetToken via email (wire up your email service here)
  // Example: await emailService.sendPasswordReset(user.email, resetToken);

  // In development: return the token directly so you can test in Postman
  if (process.env.NODE_ENV !== 'production') {
    return resetToken;
  }

  return null; // In production: token goes via email only
}

// ─── 8. RESET PASSWORD ────────────────────────────────────────
/**
 * Completes the password-reset flow.
 * - Verifies the reset token (JWT)
 * - Hashes the new password
 * - Saves it to DB and revokes all existing sessions
 */
export async function resetPassword(dto: ResetPasswordDto): Promise<void> {
  // 1. Verify reset token
  const payload = verifyResetToken(dto.token);

  // 2. Fetch user
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) {
    throw new AppError('User not found or account is inactive.', 400);
  }

  // 3. Hash new password
  const newHash = await hashPassword(dto.newPassword);

  // 4. Update password and revoke all sessions
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data:  { passwordHash: newHash },
    }),
    prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
  ]);
}
