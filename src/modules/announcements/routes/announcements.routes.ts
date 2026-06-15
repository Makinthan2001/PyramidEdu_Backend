import { Router } from 'express';
import { Role } from '@prisma/client';
import { jwtGuard } from '../../auth/guards/jwt.guard';
import { roleGuard } from '../../auth/guards/role.guard';
import { validate } from '../../../middleware/validate';
import * as controller from '../controller/announcements.controller';
import validators from '../validators/announcements.validator';

const router = Router();

// Secure all routes
router.use(jwtGuard);

// CRUD routes
router.get('/', controller.getAnnouncements);
router.get('/my', controller.getMyAnnouncements);
router.get('/received', controller.getReceivedAnnouncements);

router.get('/:id', controller.getAnnouncementById);

router.post(
  '/',
  roleGuard(Role.ADMIN, Role.MANAGER, Role.TEACHER),
  validate(validators.createAnnouncementSchema),
  controller.createAnnouncement
);

router.patch(
  '/:id',
  roleGuard(Role.ADMIN, Role.MANAGER, Role.TEACHER),
  validate(validators.updateAnnouncementSchema),
  controller.updateAnnouncement
);

router.delete(
  '/:id',
  roleGuard(Role.ADMIN, Role.MANAGER, Role.TEACHER),
  controller.deleteAnnouncement
);

router.patch(
  '/:id/publish',
  roleGuard(Role.ADMIN, Role.MANAGER, Role.TEACHER),
  controller.publishAnnouncement
);

router.patch(
  '/:id/archive',
  roleGuard(Role.ADMIN, Role.MANAGER, Role.TEACHER),
  controller.archiveAnnouncement
);

export default router;
