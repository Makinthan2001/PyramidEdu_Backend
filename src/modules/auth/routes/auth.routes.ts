import { Router } from 'express';
import { validate } from '../../../middleware/validate';
import { authenticate } from '../../../middleware/authenticate';
import * as controller from '../controller/auth.controller';
import { registerSchema } from '../validators/auth.validator';
import { loginSchema } from '../dto/login.dto';
import { changePasswordSchema } from '../dto/change-password.dto';
import { forgotPasswordSchema } from '../dto/forgot-password.dto';
import { resetPasswordSchema } from '../dto/reset-password.dto';

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