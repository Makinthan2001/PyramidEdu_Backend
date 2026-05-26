import { Router } from 'express';
import * as controller from '../controller/health.controller';

const router = Router();


//  * Liveness check - confirms API process is running
router.get('/', controller.liveness);

//  * Readiness check - confirms database and Redis connections
//  * Returns 503 Service Unavailable if dependencies are down
router.get('/ready', controller.readiness);

//  * Version check - returns API version and build information
router.get('/version', controller.version);

export default router;
