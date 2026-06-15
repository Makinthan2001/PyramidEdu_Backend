import { Router } from 'express';
import { jwtGuard } from '../../auth/guards/jwt.guard';
import * as controller from '../controller/notification.controller';

const router = Router();

// Secure all notification routes
router.use(jwtGuard);

router.get('/', controller.getUserNotifications);
router.get('/unread-count', controller.getUnreadCount);
router.patch('/read-all', controller.markAllAsRead);
router.get('/:id', controller.getNotificationDetails);
router.patch('/:id/read', controller.markAsRead);
router.delete('/:id', controller.softDeleteNotification);

export default router;
