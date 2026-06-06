/**
 * Users Validators - Barrel re-exports all user validation schemas
 * Individual schemas are defined in dto/ folder
 */

export {
  createManagerSchema,
  createTeacherSchema,
  createStudentSchema,
  createAdminSchema,
  updateUserSchema,
  type CreateManagerDto,
  type CreateTeacherDto,
  type CreateStudentDto,
  type CreateAdminDto,
  type CreateUserDto,
  type UpdateUserDto,
} from '../dto';

export default {};
