import { Role, AuditAction } from '@prisma/client';
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
import { AppError } from '../../../utils/AppError';
import type { AuthTokens, LoginResult, SafeUser } from '../../../types/auth.types';
import type { RegisterDto } from '../validators/auth.validator';
import type { LoginDto } from '../dto/login.dto';
import type { ChangePasswordDto } from '../dto/change-password.dto';
import type { ForgotPasswordDto } from '../dto/forgot-password.dto';
import type { ResetPasswordDto } from '../dto/reset-password.dto';

const userProfileInclude = {
  student: true,
  teacher: true,
  manager: true,
  admin: true,
};

async function toSafeUser(user: any): Promise<SafeUser> {
  const response: SafeUser = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    forcePwdChange: user.forcePwdChange,
    createdAt: user.createdAt,
    phone: user.phone || undefined,
    profileImage: user.profileImage || undefined,
  };

  if (user.student) {
    response.phone = user.student.phone || response.phone;
    response.address = user.student.address || undefined;
  }

  if (user.teacher) {
    response.phone = user.teacher.phone || response.phone;
    response.address = user.teacher.address || undefined;
    response.teacherProfileId = user.teacher.id;
    if (user.teacher.subjectId) {
      response.subjectId = user.teacher.subjectId;
      const subject = await prisma.subject.findUnique({
        where: { id: user.teacher.subjectId },
        select: { subjectName: true },
      });
      if (subject) {
        response.subject = subject.subjectName;
      }
    }
  }

  if (user.manager) {
    response.address = user.manager.address || undefined;
  }

  return response;
}

export async function registerUser(dto: RegisterDto): Promise<SafeUser> {
  const email = dto.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError('An account with this email already exists.', 409);
  }

  const hashedPassword = await hashPassword(dto.password);

  let user: any;
  await prisma.$transaction(async (tx) => {
    user = await tx.user.create({
      data: {
        email,
        fullName: dto.fullName,
        password: hashedPassword,
        role: dto.role,
      },
    });

    if (dto.role === Role.ADMIN) {
      await tx.admin.create({
        data: {
          userId: user.id,
          accessLevel: 1,
        },
      });
    } else if (dto.role === Role.MANAGER) {
      await tx.manager.create({
        data: {
          userId: user.id,
        },
      });
    } else if (dto.role === Role.TEACHER) {
      await tx.teacher.create({
        data: {
          userId: user.id,
        },
      });
    }
  });

  return await toSafeUser(user);
}

export async function loginUser(dto: LoginDto): Promise<LoginResult> {
  const email = dto.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    include: userProfileInclude,
  });
  if (!user) {
    throw new AppError('Invalid email or password.', 401);
  }

  if (!user.isActive) {
    throw new AppError('Your account has been deactivated. Please contact an administrator.', 403);
  }

  if (!dto.password || typeof dto.password !== 'string') {
    throw new AppError('Password is required.', 400);
  }
  const incomingPassword = dto.password;
  const isMatch = await comparePasswords(incomingPassword, user.password);

  if (!isMatch) {
    console.warn(`Failed login attempt for ${email}: password did not match stored hash.`);
    throw new AppError('Invalid email or password.', 401);
  }

  if (user.role === Role.STUDENT) {
    const student = await prisma.student.findUnique({ where: { userId: user.id } });
    if (!student || student.approvalStatus !== 'APPROVED') {
      throw new AppError('Your account is pending approval. Please contact the administration.', 403);
    }
  }

  const accessToken = generateAccessToken({ sub: user.id, email: user.email, role: user.role });
  const refreshToken = generateRefreshToken(user.id);

  const refreshExpires = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: expiryStringToDate(refreshExpires),
    },
  });

  return {
    user: await toSafeUser(user),
    tokens: { accessToken, refreshToken },
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
  const payload = verifyRefreshToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });

  if (!stored) {
    await prisma.refreshToken.deleteMany({ where: { userId: payload.sub } });
    throw new AppError('Refresh token reuse detected. All sessions have been terminated.', 401);
  }

  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { token: refreshToken } });
    throw new AppError('Refresh token has expired. Please log in again.', 401);
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) {
    await prisma.refreshToken.deleteMany({ where: { userId: payload.sub } });
    throw new AppError('User not found or account deactivated.', 401);
  }

  await prisma.refreshToken.delete({ where: { token: refreshToken } });

  const newRefreshToken = generateRefreshToken(user.id);
  const newAccessToken = generateAccessToken({ sub: user.id, email: user.email, role: user.role });

  const refreshExpires = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: newRefreshToken,
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

    await prisma.refreshToken.delete({ where: { token: refreshToken } });
  } catch {
    return;
  }
}

export async function getCurrentUser(userId: string): Promise<SafeUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userProfileInclude,
  });
  if (!user) {
    throw new AppError('User not found.', 404);
  }
  return await toSafeUser(user);
}

export async function changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('User not found.', 404);
  }

  const isMatch = await comparePasswords(dto.currentPassword, user.password);
  if (!isMatch) {
    throw new AppError('Current password is incorrect.', 400);
  }

  const newHash = await hashPassword(dto.newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { password: newHash },
    }),
    prisma.refreshToken.deleteMany({ where: { userId } }),
  ]);
}

export async function forgotPassword(dto: ForgotPasswordDto): Promise<string | null> {
  const email = dto.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

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
      data: { password: newHash },
    }),
    prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
  ]);
}