import { Router } from 'express';
import { validate } from '../../../../middleware/validate';
import { authenticateMobileStudent } from '../middleware/authenticate';
import * as controller from '../controller/auth.controller';
import { loginSchema, refreshTokenSchema, logoutSchema } from '../validators/auth.validator';
import { forgotPassword, resetPassword, verifyOtp } from '../../../auth/controller/auth.controller';
import { forgotPasswordSchema } from '../../../auth/dto/forgot-password.dto';
import { resetPasswordSchema } from '../../../auth/dto/reset-password.dto';
import { verifyOtpSchema } from '../../../auth/dto/verify-otp.dto';

const router = Router();

router.post('/login', validate(loginSchema), controller.login);
router.post('/refresh', validate(refreshTokenSchema), controller.refreshToken);
router.post('/logout', validate(logoutSchema), controller.logout);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/verify-otp', validate(verifyOtpSchema), verifyOtp);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);
router.get('/me', authenticateMobileStudent, controller.getMe);

export default router;