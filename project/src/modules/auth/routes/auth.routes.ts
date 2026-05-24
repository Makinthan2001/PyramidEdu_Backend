// ============================================================
// src/modules/auth/routes/auth.routes.ts
// Defines all /api/auth/* endpoints.
// Each route clearly shows: validators → middleware → controller
// ============================================================

import { Router } from 'express';
import { validate }       from '../../../middleware/validate';
import { authenticate }   from '../../../middleware/authenticate';
import * as controller    from '../controller/auth.controller';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/auth.validator';

const router = Router();

// ─── Public routes (no JWT required) ─────────────────────────

/**
 * POST /api/auth/register
 * Create a new user account (ADMIN / MANAGER / TEACHER).
 * Body: { email, password, role }
 */
router.post('/register', validate(registerSchema), controller.register);

/**
 * POST /api/auth/login
 * Authenticate and receive access token + refresh token cookie.
 * Body: { email, password }
 */
router.post('/login', validate(loginSchema), controller.login);

/**
 * POST /api/auth/refresh
 * Use the httpOnly cookie refreshToken to get a new access token.
 * (No body required — token is read from cookie)
 */
router.post('/refresh', controller.refreshToken);

/**
 * POST /api/auth/logout
 * Revoke the current refresh token.
 * Add ?all=true to revoke ALL sessions for the user.
 */
router.post('/logout', controller.logout);

/**
 * POST /api/auth/forgot-password
 * Request a password-reset email.
 * Body: { email }
 */
router.post('/forgot-password', validate(forgotPasswordSchema), controller.forgotPassword);

/**
 * POST /api/auth/reset-password
 * Complete the reset using the token from the email link.
 * Body: { token, newPassword, confirmPassword }
 */
router.post('/reset-password', validate(resetPasswordSchema), controller.resetPassword);

// ─── Protected routes (JWT required) ─────────────────────────

/**
 * GET /api/auth/me
 * Get the currently authenticated user's profile.
 * Header: Authorization: Bearer <accessToken>
 */
router.get('/me', authenticate, controller.getMe);

/**
 * PATCH /api/auth/change-password
 * Change password while logged in.
 * Header: Authorization: Bearer <accessToken>
 * Body: { currentPassword, newPassword, confirmPassword }
 */
router.patch(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  controller.changePassword,
);

export default router;
