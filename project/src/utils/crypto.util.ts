// ============================================================
// src/utils/crypto.util.ts
// Cryptographic helpers used by the auth system.
// ============================================================

import crypto from 'crypto';

/**
 * Generates a cryptographically random string (hex).
 * Used as a "token family" identifier for refresh-token rotation.
 * Each login session gets a unique family; reuse within a family
 * indicates token theft and triggers full session invalidation.
 */
export function generateTokenFamily(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hashes a value with SHA-256 (not bcrypt — just for storage lookup).
 * We store the hash of refresh tokens in the DB so a leaked DB
 * does not expose usable tokens directly.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
