import { Prisma } from '@prisma/client';
import prisma from '../../../../config/prisma.config';

export type StudentAuthRecord = Prisma.UserGetPayload<{
  include: {
    student: true;
  };
}>;

export const MobileAuthRepository = {
  findStudentByEmail(email: string): Promise<StudentAuthRecord | null> {
    return prisma.user.findUnique({
      where: { email },
      include: { student: true },
    });
  },

  findStudentById(userId: number): Promise<StudentAuthRecord | null> {
    return prisma.user.findUnique({
      where: { id: userId },
      include: { student: true },
    });
  },

  findRefreshTokenByHash(tokenHash: string) {
    return prisma.refreshToken.findUnique({ where: { tokenHash } });
  },

  createRefreshToken(data: {
    userId: number;
    tokenHash: string;
    tokenFamily: string;
    expiresAt: Date;
  }) {
    return prisma.refreshToken.create({ data });
  },

  deleteRefreshTokenByHash(tokenHash: string) {
    return prisma.refreshToken.deleteMany({ where: { tokenHash } });
  },

  deleteRefreshTokensByUserId(userId: number) {
    return prisma.refreshToken.deleteMany({ where: { userId } });
  },
};

export default MobileAuthRepository;