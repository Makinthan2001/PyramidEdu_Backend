import { Router } from 'express';
import { Role } from '@prisma/client';
import { jwtGuard } from '../../../modules/auth/guards/jwt.guard';
import { roleGuard } from '../../../modules/auth/guards/role.guard';
import { validate } from '../../../middleware/validate';
import * as controller from '../controller/support-staff.controller';
import { supportStaffValidator } from '../validators/support-staff.validator';

const router = Router();

// Protected routes
router.use(jwtGuard);

// ADMIN & MANAGER can list all support staff
router.get('/', roleGuard(Role.ADMIN, Role.MANAGER), controller.getSupportStaff);

// Get support staff by ID – ADMIN, MANAGER
router.get('/:id', roleGuard(Role.ADMIN, Role.MANAGER), controller.getSupportStaffById);

// Create support staff – ADMIN only
router.post('/', roleGuard(Role.ADMIN), validate(supportStaffValidator.createSupportStaffSchema), controller.createSupportStaff);

// Update support staff – ADMIN or MANAGER
router.patch('/:id', roleGuard(Role.ADMIN, Role.MANAGER), validate(supportStaffValidator.updateSupportStaffSchema), controller.updateSupportStaff);

// Delete (soft) support staff – ADMIN only
router.delete('/:id', roleGuard(Role.ADMIN), controller.deleteSupportStaff);

export default router;
