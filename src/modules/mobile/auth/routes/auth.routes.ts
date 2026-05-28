import { Router } from 'express';
import { validate } from '../../../../middleware/validate';
import { authenticateMobileStudent } from '../middleware/authenticate';
import * as controller from '../controller/auth.controller';
import { loginSchema, refreshTokenSchema, logoutSchema } from '../validators/auth.validator';

const router = Router();

router.post('/login', validate(loginSchema), controller.login);
router.post('/refresh', validate(refreshTokenSchema), controller.refreshToken);
router.post('/logout', validate(logoutSchema), controller.logout);
router.get('/me', authenticateMobileStudent, controller.getMe);

export default router;