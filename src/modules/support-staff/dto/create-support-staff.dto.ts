import { z } from 'zod';

export const createSupportStaffSchema = z.object({
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  nicNumber: z.string().min(10).max(20),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  address: z.string().min(5).max(200),
  roleType: z.string().min(2).max(50),
  salary: z.number().min(0).optional(),
  email: z.string().email().optional(), // accepted for form compatibility but not stored
  phoneNumber: z.string().min(10).max(20),
  staffCode: z.string().optional(),
  position: z.string().optional(),
  department: z.string().optional(),
  hireDate: z.string().datetime().or(z.date()).optional(),
});

export type CreateSupportStaffDto = z.infer<typeof createSupportStaffSchema>;
