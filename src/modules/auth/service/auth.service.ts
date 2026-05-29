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
import type { AuthTokens, LoginResult, SafeUser } from '../../../types/auth.types';
import type { RegisterDto } from '../validators/auth.validator';
import type { LoginDto } from '../dto/login.dto';
import type { ChangePasswordDto } from '../dto/change-password.dto';
import type { ForgotPasswordDto } from '../dto/forgot-password.dto';
import type { ResetPasswordDto } from '../dto/reset-password.dto';

function toSafeUser(user: {
  id: number;
  email: string;
  role: UserRole;
  isActive: boolean;
  forcePasswordChange: boolean;
  createdAt: Date;
}): SafeUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    forcePasswordChange: user.forcePasswordChange,
    createdAt: user.createdAt,
  };
}

export async function registerUser(dto: RegisterDto): Promise<SafeUser> {
  const existing = await prisma.user.findUnique({ where: { email: dto.email } });
  if (existing) {
    throw new AppError('An account with this email already exists.', 409);
  }

  const passwordHash = await hashPassword(dto.password);

  const user = await prisma.user.create({
    data: {
      email: dto.email,
      passwordHash,
      role: dto.role,
    },
  });

  return toSafeUser(user);
}

export async function loginUser(dto: LoginDto): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { email: dto.email } });
  if (!user) {
    throw new AppError('Invalid email or password.', 401);
  }

  if (!user.isActive) {
    throw new AppError('Your account has been deactivated. Please contact an administrator.', 403);
  }

  const isMatch = await comparePasswords(dto.password, user.passwordHash);
  if (!isMatch) {
    throw new AppError('Invalid email or password.', 401);
  }

  // If user is a student, ensure their student profile is approved
  if (user.role === UserRole.STUDENT) {
    const student = await prisma.student.findUnique({ where: { userId: user.id } });
    // Prisma client types may be out-of-sync with schema during migrations; cast to any for safety
    if (!student || (student as any).isApproved === false) {
      throw new AppError('Your account is pending approval. Please contact the administration.', 403);
    }
  }

  const tokenFamily = generateTokenFamily();
  const accessToken = generateAccessToken({ sub: user.id, email: user.email, role: user.role });
  const refreshToken = generateRefreshToken(user.id, tokenFamily);

  const refreshExpires = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      tokenFamily,
      expiresAt: expiryStringToDate(refreshExpires),
    },
  });

  return {
    user: toSafeUser(user),
    tokens: { accessToken, refreshToken },
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
  const payload = verifyRefreshToken(refreshToken);
  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored) {
    await prisma.refreshToken.deleteMany({ where: { userId: payload.sub } });
    throw new AppError('Refresh token reuse detected. All sessions have been terminated.', 401);
  }

  if (stored.tokenFamily !== payload.tokenFamily) {
    await prisma.refreshToken.deleteMany({ where: { userId: payload.sub } });
    throw new AppError('Token family mismatch. Please log in again.', 401);
  }

  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { tokenHash } });
    throw new AppError('Refresh token has expired. Please log in again.', 401);
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) {
    await prisma.refreshToken.deleteMany({ where: { userId: payload.sub } });
    throw new AppError('User not found or account deactivated.', 401);
  }

  await prisma.refreshToken.delete({ where: { tokenHash } });

  const newRefreshToken = generateRefreshToken(user.id, payload.tokenFamily);
  const newAccessToken = generateAccessToken({ sub: user.id, email: user.email, role: user.role });

  const refreshExpires = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(newRefreshToken),
      tokenFamily: payload.tokenFamily,
      expiresAt: expiryStringToDate(refreshExpires),
    },
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function logoutUser(refreshToken: string, logoutAll = false): Promise<void> {
  try {
    const payload = verifyRefreshToken(refreshToken);

    if (logoutAll) {
      await prisma.refreshToken.deleteMany({ where: { userId: payload.sub } });
      return;
    }

    await prisma.refreshToken.deleteMany({ where: { tokenHash: hashToken(refreshToken) } });
  } catch {
    return;
  }
}

export async function getCurrentUser(userId: number): Promise<SafeUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('User not found.', 404);
  }
  return toSafeUser(user);
}

export async function changePassword(userId: number, dto: ChangePasswordDto): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('User not found.', 404);
  }

  const isMatch = await comparePasswords(dto.currentPassword, user.passwordHash);
  if (!isMatch) {
    throw new AppError('Current password is incorrect.', 400);
  }

  const newHash = await hashPassword(dto.newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    }),
    prisma.refreshToken.deleteMany({ where: { userId } }),
  ]);
}

export async function forgotPassword(dto: ForgotPasswordDto): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { email: dto.email } });

  if (!user || !user.isActive) {
    return null;
  }

  const resetToken = generateResetToken(user.id);

  if (process.env.NODE_ENV !== 'production') {
    return resetToken;
  }

  return null;
}

export async function resetPassword(dto: ResetPasswordDto): Promise<void> {
  const payload = verifyResetToken(dto.token);

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) {
    throw new AppError('User not found or account is inactive.', 400);
  }

  const newHash = await hashPassword(dto.newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    }),
    prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
  ]);
}