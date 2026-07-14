import { Router } from 'express';
import { authenticateMobileStudent } from '../../auth/middleware/authenticate';
import * as controller from '../controller/profile.controller';
import { validate } from '../../../../middleware/validate';
import { updateUserSchema } from '../../../users/dto/update-user.dto';

const router = Router();

router.get('/', authenticateMobileStudent, controller.getProfile);
router.put('/', authenticateMobileStudent, validate(updateUserSchema), controller.updateProfile);

export default router;
