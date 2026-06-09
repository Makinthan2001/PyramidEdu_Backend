"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.comparePasswords = comparePasswords;
exports.generateTemporaryPassword = generateTemporaryPassword;
exports.isStrongPassword = isStrongPassword;
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = __importDefault(require("crypto"));
const SALT_ROUNDS = 12;
function hashPassword(plainPassword) {
    return __awaiter(this, void 0, void 0, function* () {
        return bcrypt_1.default.hash(plainPassword, SALT_ROUNDS);
    });
}
function comparePasswords(plainPassword, hashedPassword) {
    return __awaiter(this, void 0, void 0, function* () {
        return bcrypt_1.default.compare(plainPassword, hashedPassword);
    });
}
/**
 * Generate a cryptographically secure temporary password.
 * Ensures at least one upper, lower, digit and special character.
 */
function generateTemporaryPassword(length = 12) {
    const minLen = Math.max(10, length);
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const specials = '!@#$%^&*()-_=+[]{}|;:,.<>?';
    const pick = (set) => set[crypto_1.default.randomInt(0, set.length)];
    // Ensure required characters
    const required = [pick(upper), pick(lower), pick(digits), pick(specials)];
    const all = upper + lower + digits + specials;
    const remainingCount = minLen - required.length;
    const remaining = [];
    for (let i = 0; i < remainingCount; i++) {
        remaining.push(pick(all));
    }
    const passwordChars = required.concat(remaining);
    // Fisher-Yates shuffle using crypto
    for (let i = passwordChars.length - 1; i > 0; i--) {
        const j = crypto_1.default.randomInt(0, i + 1);
        const tmp = passwordChars[i];
        passwordChars[i] = passwordChars[j];
        passwordChars[j] = tmp;
    }
    return passwordChars.join('');
}
/**
 * Basic strong password checker used for password-change endpoints.
 */
function isStrongPassword(password, minLength = 10) {
    if (!password || password.length < minLength)
        return false;
    if (!/[A-Z]/.test(password))
        return false;
    if (!/[a-z]/.test(password))
        return false;
    if (!/[0-9]/.test(password))
        return false;
    if (!/[!@#$%^&*()\-_=+\[\]{}|;:,.<>?]/.test(password))
        return false;
    return true;
}
