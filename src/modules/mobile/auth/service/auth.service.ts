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
  profileImage: string | null;
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
    gender: string | null;
    school: string | null;
    batch: string | null;
    nic: string | null;
    rewardPoints: number;
    attendancePercentage: number;
    performanceStatus: string | null;
    trendStatus: string | null;
    approvalStatus: string;
    paymentStatus: string;
    totalFeeAmount: number;
    parentName: string | null;
    parentPhone: string | null;
    parentOccupation: string | null;
    parentEmail: string | null;
    streamName: string | null;
    subjects: string | null;
    teachers: string | null;
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

  const enrollments = user.student.enrollments || [];
  const subjects = enrollments
    .map((e: any) => e.subject?.subjectName)
    .filter(Boolean)
    .join(', ');
  
  const teachers = enrollments
    .map((e: any) => e.teacher?.user?.fullName)
    .filter(Boolean)
    .filter((val: any, index: any, self: any) => self.indexOf(val) === index)
    .join(', ');

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    profileImage: user.profileImage ?? null,
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
      gender: user.student.gender ?? null,
      school: user.student.school ?? null,
      batch: user.student.batch ?? null,
      nic: user.student.nic ?? null,
      rewardPoints: user.student.rewardPoints,
      attendancePercentage: Number(user.student.attendancePercentage),
      performanceStatus: user.student.performanceStatus ?? null,
      trendStatus: user.student.trendStatus ?? null,
      approvalStatus: user.student.approvalStatus,
      paymentStatus: user.student.paymentStatus,
      totalFeeAmount: Number(user.student.totalFeeAmount),
      parentName: user.student.parent?.parentName ?? null,
      parentPhone: user.student.parent?.phone ?? null,
      parentOccupation: user.student.parent?.occupation ?? null,
      parentEmail: user.student.parent?.email ?? null,
      streamName: user.student.stream?.streamName ?? null,
      subjects: subjects || 'Not Enrolled',
      teachers: teachers || 'None Assigned',
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
