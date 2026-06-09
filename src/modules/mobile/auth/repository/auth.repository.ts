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
      where: { email: email.toLowerCase() },
      include: { student: true },
    });
  },

  findStudentById(userId: string): Promise<StudentAuthRecord | null> {
    return prisma.user.findUnique({
      where: { id: userId },
      include: { student: true },
    });
  },

  findRefreshTokenByToken(token: string) {
    return prisma.refreshToken.findUnique({ where: { token } });
  },

  createRefreshToken(data: {
    userId: string;
    token: string;
    expiresAt: Date;
  }) {
    return prisma.refreshToken.create({ data });
  },

  deleteRefreshTokenByToken(token: string) {
    return prisma.refreshToken.delete({ where: { token } });
  },

  deleteRefreshTokensByUserId(userId: string) {
    return prisma.refreshToken.deleteMany({ where: { userId } });
  },
};

export default MobileAuthRepository;