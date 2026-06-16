import { z } from 'zod';

export const updateSupportStaffSchema = z.object({
  firstName: z.string().min(2).max(50).optional(),
  lastName: z.string().min(2).max(50).optional(),
  nicNumber: z.string().min(10).max(20).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  address: z.string().min(5).max(200).optional(),
  roleType: z.string().min(2).max(50).optional(),
  salary: z.number().min(0).optional(),
  email: z.string().email().optional(),
  phoneNumber: z.string().min(10).max(20).optional(),
  staffCode: z.string().optional(),
  position: z.string().optional(),
  department: z.string().optional(),
  hireDate: z.string().datetime().or(z.date()).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateSupportStaffDto = z.infer<typeof updateSupportStaffSchema>;
