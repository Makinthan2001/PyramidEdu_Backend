import { Router } from 'express';
import { validate } from '../../../middleware/validate';
import { authenticate } from '../../../middleware/authenticate';
import * as controller from '../controller/auth.controller';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/auth.validator';

const router = Router();

router.post('/register', validate(registerSchema), controller.register);
router.post('/login', validate(loginSchema), controller.login);
router.post('/refresh', controller.refreshToken);
router.post('/logout', controller.logout);
router.post('/forgot-password', validate(forgotPasswordSchema), controller.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), controller.resetPassword);
router.get('/me', authenticate, controller.getMe);
router.patch('/change-password', authenticate, validate(changePasswordSchema), controller.changePassword);

export default router;