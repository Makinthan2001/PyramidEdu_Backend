import { Router } from 'express';
import * as controller from '../controller/health.controller';

const router = Router();

router.get('/', controller.liveness);
router.get('/ready', controller.readiness);
router.get('/version', controller.version);

export default router;