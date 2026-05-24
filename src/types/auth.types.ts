import { UserRole } from '@prisma/client';

export interface JwtAccessPayload {
  sub: number;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface JwtRefreshPayload {
  sub: number;
  tokenFamily: string;
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
  id: number;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
}

export interface PasswordResetPayload {
  sub: number;
  purpose: 'password_reset';
  iat?: number;
  exp?: number;
}

export {};