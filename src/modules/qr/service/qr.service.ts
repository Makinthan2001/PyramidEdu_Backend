import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../../config/prisma.config';
import { AppError } from '../../../utils/AppError';

export class QRService {
  static async generateStudentQR(studentId: string) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true },
    });

    if (!student) {
      throw new AppError('Student not found', 404);
    }

    const token = uuidv4();

    await prisma.$transaction(async (tx) => {
      // 1. Mark existing QR codes as inactive
      await tx.qRCode.updateMany({
        where: { studentId },
        data: { isActive: false },
      });

      // 2. Create new QR code
      await tx.qRCode.create({
        data: {
          studentId,
          qrToken: token,
          isActive: true,
        },
      });

      // 3. Update the permanent QR token on the student profile (if needed for fast access)
      await tx.student.update({
        where: { id: studentId },
        data: { qrCode: token },
      });
    });

    // Convert token -> QR PNG image (base64 string)
    const qrImageBase64 = await QRCode.toDataURL(token, {
      width: 500,
      margin: 2,
      errorCorrectionLevel: 'H', // Works even if card is slightly damaged/folded
      color: { dark: '#000000', light: '#ffffff' },
    });

    return {
      studentId,
      studentName: student.user.fullName,
      studentCode: student.indexNumber || 'N/A',
      token,
      qrImageBase64,
    };
  }

  static async getStudentQR(studentId: string) {
    const qr = await prisma.qRCode.findFirst({
      where: { studentId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!qr) {
      throw new AppError('No active QR found for this student', 404);
    }

    const img = await QRCode.toDataURL(qr.qrToken, { width: 400 });

    return { qrImageBase64: img };
  }
}
