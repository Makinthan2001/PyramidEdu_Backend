export {
  createManagerSchema,
  createTeacherSchema,
  createSupportStaffSchema,
  createStudentSchema,
  createAdminSchema,
  type CreateManagerDto,
  type CreateTeacherDto,
  type CreateSupportStaffDto,
  type CreateStudentDto,
  type CreateAdminDto,
  type CreateUserDto,
} from './create-user.dto';

export { updateUserSchema, type UpdateUserDto } from './update-user.dto';

export { changePasswordSchema, adminResetPasswordSchema, type ChangePasswordDto, type AdminResetPasswordDto } from './change-password.dto';
