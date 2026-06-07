import { Role } from '@prisma/client';
import { AppError } from '../../../../utils/AppError';
import { comparePasswords } from '../../../../utils/password.util';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  expiryStringToDate,
} from '../../../../utils/jwt.util';
import type { AuthTokens } from '../../../../types/auth.types';
import MobileAuthRepository, { type StudentAuthRecord } from '../repository/auth.repository';
import type { LoginDto } from '../dto/login.dto';

const MOBILE_ACCESS_EXPIRES = process.env.JWT_MOBILE_ACCESS_EXPIRES_IN || process.env.JWT_ACCESS_EXPIRES_IN || '10m';
const MOBILE_REFRESH_EXPIRES = process.env.JWT_MOBILE_REFRESH_EXPIRES_IN || '30d';

export interface MobileStudentSession {
  id: string;
  email: string;
  fullName: string;
  role: Role; // runtime value set as 'STUDENT'
  isActive: boolean;
  forcePwdChange: boolean;
  createdAt: Date;
  student: {
    id: string;
    indexNumber: string | null;
    phone: string | null;
    address: string | null;
    dateOfBirth: string | null;
  };
}

export interface MobileLoginResult {
  student: MobileStudentSession;
  tokens: AuthTokens;
}

function toStudentSession(user: StudentAuthRecord): MobileStudentSession {
  if (!user.student) {
    throw new AppError('Student profile not found.', 404);
  }

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: Role.STUDENT,
    isActive: user.isActive,
    forcePwdChange: user.forcePwdChange,
    createdAt: user.createdAt,
    student: {
      id: user.student.id,
      indexNumber: user.student.indexNumber ?? null,
      phone: user.student.phone ?? null,
      address: user.student.address ?? null,
      dateOfBirth: user.student.dateOfBirth ? user.student.dateOfBirth.toISOString().slice(0, 10) : null,
    },
  };
}

export async function loginStudent(dto: LoginDto): Promise<MobileLoginResult> {
  const user = await MobileAuthRepository.findStudentByEmail(dto.email.trim().toLowerCase());

  if (!user || user.role !== Role.STUDENT || !user.student) {
    throw new AppError('Invalid email or password.', 401);
  }

  if (!user.isActive) {
    throw new AppError('Your account has been deactivated. Please contact the school administration.', 403);
  }

  const isMatch = await comparePasswords(dto.password, user.password);
  if (!isMatch) {
    throw new AppError('Invalid email or password.', 401);
  }

  // Ensure student profile has been approved
  if (!user.student || user.student.approvalStatus !== 'APPROVED') {
    throw new AppError('Your account is pending approval. Please contact the school administration.', 403);
  }

  const accessToken = generateAccessToken(
    { sub: user.id, email: user.email, role: user.role },
    MOBILE_ACCESS_EXPIRES,
  );
  const refreshToken = generateRefreshToken(user.id, MOBILE_REFRESH_EXPIRES);

  await MobileAuthRepository.createRefreshToken({
    userId: user.id,
    token: refreshToken,
    expiresAt: expiryStringToDate(MOBILE_REFRESH_EXPIRES),
  });

  return {
    student: toStudentSession(user),
    tokens: { accessToken, refreshToken },
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
  const payload = verifyRefreshToken(refreshToken);
  const stored = await MobileAuthRepository.findRefreshTokenByToken(refreshToken);

  if (!stored) {
    await MobileAuthRepository.deleteRefreshTokensByUserId(payload.sub);
    throw new AppError('Refresh token reuse detected. All sessions have been terminated.', 401);
  }

  if (stored.expiresAt < new Date()) {
    await MobileAuthRepository.deleteRefreshTokenByToken(refreshToken);
    throw new AppError('Refresh token has expired. Please log in again.', 401);
  }

  const user = await MobileAuthRepository.findStudentById(payload.sub);
  if (!user || user.role !== Role.STUDENT || !user.isActive || !user.student) {
    await MobileAuthRepository.deleteRefreshTokensByUserId(payload.sub);
    throw new AppError('Student account not found or inactive.', 401);
  }

  await MobileAuthRepository.deleteRefreshTokenByToken(refreshToken);

  const newRefreshToken = generateRefreshToken(user.id, MOBILE_REFRESH_EXPIRES);
  const newAccessToken = generateAccessToken(
    { sub: user.id, email: user.email, role: user.role },
    MOBILE_ACCESS_EXPIRES,
  );

  await MobileAuthRepository.createRefreshToken({
    userId: user.id,
    token: newRefreshToken,
    expiresAt: expiryStringToDate(MOBILE_REFRESH_EXPIRES),
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function logoutStudent(refreshToken: string, logoutAll = false): Promise<void> {
  try {
    const payload = verifyRefreshToken(refreshToken);

    if (logoutAll) {
      await MobileAuthRepository.deleteRefreshTokensByUserId(payload.sub);
      return;
    }

    await MobileAuthRepository.deleteRefreshTokenByToken(refreshToken);
  } catch {
    return;
  }
}

export async function getCurrentStudent(userId: string): Promise<MobileStudentSession> {
  const user = await MobileAuthRepository.findStudentById(userId);

  if (!user || user.role !== Role.STUDENT || !user.student) {
    throw new AppError('Student account not found.', 404);
  }

  return toStudentSession(user);
}
