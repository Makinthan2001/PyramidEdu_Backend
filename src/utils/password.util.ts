import bcrypt from 'bcrypt';
import crypto from 'crypto';

const SALT_ROUNDS = 12;

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function comparePasswords(plainPassword: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Generate a cryptographically secure temporary password.
 * Ensures at least one upper, lower, digit and special character.
 */
export function generateTemporaryPassword(length = 12): string {
  const minLen = Math.max(10, length);
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const specials = '!@#$%^&*()-_=+[]{}|;:,.<>?';

  const pick = (set: string) => set[crypto.randomInt(0, set.length)];

  // Ensure required characters
  const required = [pick(upper), pick(lower), pick(digits), pick(specials)];

  const all = upper + lower + digits + specials;
  const remainingCount = minLen - required.length;
  const remaining: string[] = [];
  for (let i = 0; i < remainingCount; i++) {
    remaining.push(pick(all));
  }

  const passwordChars = required.concat(remaining);
  // Fisher-Yates shuffle using crypto
  for (let i = passwordChars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const tmp = passwordChars[i];
    passwordChars[i] = passwordChars[j];
    passwordChars[j] = tmp;
  }

  return passwordChars.join('');
}

/**
 * Basic strong password checker used for password-change endpoints.
 */
export function isStrongPassword(password: string, minLength = 10): boolean {
  if (!password || password.length < minLength) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[!@#$%^&*()\-_=+\[\]{}|;:,.<>?]/.test(password)) return false;
  return true;
}