// ============================================================
// src/utils/password.util.ts
// All bcrypt operations: hash and compare passwords.
// Salt rounds = 12 (good balance of security vs CPU time).
// ============================================================

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/**
 * Hashes a plain-text password.
 * Never store plain passwords — always call this before saving to DB.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Compares a plain-text password against a stored bcrypt hash.
 * Returns true if they match, false otherwise.
 * Timing-safe — bcrypt internally prevents timing attacks.
 */
export async function comparePasswords(
  plainPassword: string,
  hashedPassword: string,
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}
