import { Role } from '@prisma/client';

export interface JwtAccessPayload {
  sub: string;
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface JwtRefreshPayload {
  sub: string;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtAccessPayload;
    }
  }
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult {
  user: SafeUser;
  tokens: AuthTokens;
}

export interface SafeUser {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  forcePwdChange: boolean;
  createdAt: Date;
  fullName?: string;
  phone?: string;
  address?: string;
  subject?: string;
  subjectId?: string;
  teacherProfileId?: string;
}

export interface PasswordResetPayload {
  sub: string;
  purpose: 'password_reset';
  iat?: number;
  exp?: number;
}

export {};