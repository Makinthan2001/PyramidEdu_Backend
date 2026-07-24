import { Router } from "express";
import { authenticateMobileStudent } from "../auth/middleware/authenticate";
import { NotificationController } from "./notification.controller";
import * as controller from "../../notification/controller/notification.controller";

const router = Router();

router.use(authenticateMobileStudent);
router.post("/register-token", NotificationController.registerToken);

// Mobile notification actions
router.get('/', controller.getUserNotifications);
router.get('/read', controller.getReadNotifications);
router.get('/unread-count', controller.getUnreadCount);
router.patch('/read-all', controller.markAllAsRead);
router.get('/:id', controller.getNotificationDetails);
router.patch('/:id/read', controller.markAsRead);
router.delete('/:id', controller.softDeleteNotification);

export default router;
