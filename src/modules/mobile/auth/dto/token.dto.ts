import { z } from 'zod';

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required.'),
});

export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required.'),
  logoutAll: z.boolean().optional().default(false),
});

export type LogoutDto = z.infer<typeof logoutSchema>;