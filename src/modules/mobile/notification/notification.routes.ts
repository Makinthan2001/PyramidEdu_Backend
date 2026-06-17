import { Router } from "express";
import { authenticateMobileStudent } from "../auth/middleware/authenticate";
import { NotificationController } from "./notification.controller";

const router = Router();

router.use(authenticateMobileStudent);
router.post("/register-token", NotificationController.registerToken);

export default router;
