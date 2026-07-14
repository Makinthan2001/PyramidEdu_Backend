import { Router } from 'express';
import { Role } from '@prisma/client';
import { jwtGuard } from '../../../modules/auth/guards/jwt.guard';
import { roleGuard } from '../../../modules/auth/guards/role.guard';
import * as controller from '../controller/marks.controller';

const router = Router();

// Secure all endpoints in this module
router.use(jwtGuard);
router.use(roleGuard(Role.TEACHER, Role.MANAGER, Role.ADMIN));

router.get('/', controller.getMarks);

export default router;
