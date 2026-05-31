import { Router } from 'express';
import { jwtGuard } from '../../../modules/auth/guards/jwt.guard';
import { validate } from '../../../middleware/validate';
import * as controller from '../controller/users.controller';
import { 
  canManageUsers, 
  canCreateRole, 
  canAccessUser, 
  preventSelfDeactivation 
} from '../guards/users.guard';
import {
  createManagerSchema,
  createTeacherSchema,
  createStudentSchema,
  createSupportStaffSchema,
  createAdminSchema,
  updateUserSchema,
} from '../validators/users.validator';
import { changePasswordSchema } from '../dto/change-password.dto';

const router = Router();

/**
 * All routes require JWT authentication
 */
router.use(jwtGuard);

/**
 * GET /api/v1/users
 * List all users (role-based filtering)
 */
router.get('/', canManageUsers, controller.getUsers);

/**
 * GET /api/v1/users/:id
 * Get specific user by ID (with access control)
 */
router.get('/:id', canAccessUser, controller.getUserById);

/**
 * POST /api/v1/users
 * Create new user account
 * Role-based schema validation based on role in request
 */
router.post(
  '/',
  canManageUsers,
  (req, res, next) => {
    // Dynamic validation based on role
    const role = req.body.role;

    let schema;
    switch (role) {
      case 'MANAGER':
        schema = createManagerSchema;
        break;
      case 'TEACHER':
        schema = createTeacherSchema;
        break;
      case 'STUDENT':
        schema = createStudentSchema;
        break;
      case 'SUPPORT_STAFF':
        schema = createSupportStaffSchema;
        break;
      case 'ADMIN':
        schema = createAdminSchema;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid role specified',
        });
    }

    // Validate with selected schema
    validate(schema)(req, res, next);
  },
  canCreateRole,
  controller.createUser
);

/**
 * PATCH /api/v1/users/change-password
 * Change password for current authenticated user
 */
router.patch('/change-password', validate(changePasswordSchema), jwtGuard, controller.changeMyPassword);

/**
 * PATCH /api/v1/users/:id/reset-password
 * Admin resets a user's password and receives a temporary password
 */
router.patch('/:id/reset-password', canManageUsers, controller.resetUserPassword);

/**
 * PATCH /api/v1/users/:id
 * Update user details
 */
router.patch(
  '/:id',
  validate(updateUserSchema),
  canAccessUser,
  controller.updateUser
);

/**
 * DELETE /api/v1/users/:id
 * Soft-delete user account (deactivate)
 */
router.delete('/:id', canManageUsers, controller.deleteUser);

/**
 * PATCH /api/v1/users/:id/deactivate
 * Deactivate user account
 */
router.patch(
  '/:id/deactivate',
  canManageUsers,
  preventSelfDeactivation,
  controller.deactivateUser
);

/**
 * PATCH /api/v1/users/:id/activate
 * Reactivate user account
 */
router.patch(
  '/:id/activate',
  canManageUsers,
  controller.activateUser
);

/**
 * PATCH /api/v1/users/:id/approve
 * Approve a student profile (MANAGER/ADMIN)
 */
router.patch('/:id/approve', canManageUsers, controller.approveStudent);

export default router;
