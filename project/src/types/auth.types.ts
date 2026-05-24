// ============================================================
// src/types/auth.types.ts
// Shared TypeScript interfaces and types for the auth system.
// These are used across controllers, services, middleware, and utils.
// ============================================================

import { UserRole } from '@prisma/client';

// ─── JWT Payload ─────────────────────────────────────────────
// Shape of the data encoded inside every JWT access token.
export interface JwtAccessPayload {
  sub: number;       // user id (subject)
  email: string;
  role: UserRole;
  iat?: number;      // issued at  (set by jsonwebtoken automatically)
  exp?: number;      // expiry     (set by jsonwebtoken automatically)
}

// Shape of the data encoded inside every refresh token.
export interface JwtRefreshPayload {
  sub: number;       // user id
  tokenFamily: string; // used for refresh-token rotation / reuse detection
  iat?: number;
  exp?: number;
}

// ─── Express Request Extension ────────────────────────────────
// Augments Express's Request so `req.user` is always typed.
declare global {
  namespace Express {
    interface Request {
      user?: JwtAccessPayload;
    }
  }
}

// ─── Service return shapes ────────────────────────────────────
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult {
  user: SafeUser;
  tokens: AuthTokens;
}

// User object that is safe to send to the client (no password hash).
export interface SafeUser {
  id: number;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
}

// ─── Password reset ───────────────────────────────────────────
export interface PasswordResetPayload {
  sub: number;
  purpose: 'password_reset';
  iat?: number;
  exp?: number;
}
