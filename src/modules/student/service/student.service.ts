import prisma from '../../../config/prisma.config';
import { notificationService } from '../../notification/service/notification.service';
import { AppError } from '../../../utils/AppError';
import { hashPassword } from '../../../utils/password.util';
import { Role, UserStatus, type Prisma } from '@prisma/client';
import type { InitiateRegistrationDto, VerifyOtpDto } from '../dto';
import { sendEmail } from '../../../utils/email.util';

export class StudentService {
  static async initiateRegistration(dto: InitiateRegistrationDto) {
    const existingUser = await prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new AppError('Email is already registered.', 400);
    }

    if (dto.nic) {
      const existingStudent = await prisma.student.findUnique({
        where: { nic: dto.nic },
      });
      if (existingStudent) {
        throw new AppError('NIC is already registered.', 400);
      }
    }

    if (dto.selectedCourseIds.length < 1 || dto.selectedCourseIds.length > 3) {
      throw new AppError('Please select between 1 and 3 subjects.', 400);
    }

    // Ensure all subjects have an assigned teacher
    for (const subjectId of dto.selectedCourseIds) {
      if (!dto.selectedTeacherIds[subjectId]) {
        throw new AppError(`Teacher not selected for subject: ${subjectId}`, 400);
      }
    }

    // Generate 6 digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store in OtpVerification
    const payload = JSON.stringify(dto);
    
    await prisma.otpVerification.upsert({
      where: { email: dto.email },
      update: {
        otpCode,
        expiresAt,
        data: payload,
      },
      create: {
        email: dto.email,
        otpCode,
        expiresAt,
        data: payload,
      },
    });

    // Send the OTP via Email
    const emailSubject = 'PyramidEdu - Your Registration Verification Code';
    const emailHtml = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>Verify Your Registration</h2>
        <p>Hello ${dto.firstName},</p>
        <p>Thank you for registering at PyramidEdu. Your verification code is:</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px;">
          ${otpCode}
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      </div>
    `;

    await sendEmail(dto.email, emailSubject, emailHtml);

    return { message: 'OTP generated and sent successfully.' };
  }

  static async resendOtp(email: string) {
    const existingOtpRecord = await prisma.otpVerification.findUnique({
      where: { email },
    });

    if (!existingOtpRecord) {
      throw new AppError('No pending registration found for this email.', 404);
    }

    const dto: InitiateRegistrationDto = typeof existingOtpRecord.data === 'string' 
      ? JSON.parse(existingOtpRecord.data) 
      : existingOtpRecord.data as any;

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.otpVerification.update({
      where: { email },
      data: {
        otpCode,
        expiresAt,
      },
    });

    const emailSubject = 'PyramidEdu - Your New Verification Code';
    const emailHtml = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>New Verification Code</h2>
        <p>Hello ${dto.firstName},</p>
        <p>You requested a new verification code for PyramidEdu. Your new code is:</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px;">
          ${otpCode}
        </div>
        <p>This code will expire in 10 minutes.</p>
      </div>
    `;

    await sendEmail(email, emailSubject, emailHtml);

    return { message: 'A new OTP has been sent to your email.' };
  }

  static async verifyOtpAndRegister(dto: VerifyOtpDto) {
    const otpRecord = await prisma.otpVerification.findUnique({
      where: { email: dto.email },
    });

    if (!otpRecord) {
      throw new AppError('Invalid email or OTP request expired.', 400);
    }

    if (otpRecord.otpCode !== dto.otpCode) {
      throw new AppError('Invalid OTP code.', 400);
    }

    if (new Date() > otpRecord.expiresAt) {
      throw new AppError('OTP has expired. Please request a new one.', 400);
    }

    const payload = otpRecord.data as unknown as string;
    if (!payload) {
      throw new AppError('Registration data is missing or corrupted.', 500);
    }

    const regData: InitiateRegistrationDto = typeof payload === 'string' ? JSON.parse(payload) : payload;

    const existingUser = await prisma.user.findUnique({
      where: { email: regData.email },
    });

    if (existingUser) {
      throw new AppError('Email is already registered.', 400);
    }

    // Start transaction to create User, Student, Parent, and Enrollments
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const hashedPassword = await hashPassword(regData.password);

      // Create Parent if needed
      let parentId: string | undefined = undefined;
      if (regData.parentName) {
        const parent = await tx.parent.create({
          data: {
            parentName: regData.parentName,
            relation: regData.parentRelation,
            email: regData.parentEmail || null,
            phone: regData.parentPhone || null,
          },
        });
        parentId = parent.id;
      }

      // Create User with PENDING status
      const user = await tx.user.create({
        data: {
          fullName: `${regData.firstName} ${regData.lastName}`,
          email: regData.email,
          password: hashedPassword,
          phone: regData.phone,
          role: Role.STUDENT,
          status: UserStatus.PENDING,
          isActive: true, // They can log in, but app will restrict them if status=PENDING
        },
      });

      // Calculate the next indexNumber
      const batchPrefix = `STD${regData.alExamBatch}`;
      const latestStudent = await tx.student.findFirst({
        where: { indexNumber: { startsWith: batchPrefix } },
        orderBy: { indexNumber: 'desc' },
      });
      
      let nextRunningNum = 1;
      if (latestStudent && latestStudent.indexNumber) {
        const lastNumStr = latestStudent.indexNumber.slice(-4);
        const lastNum = parseInt(lastNumStr, 10);
        if (!isNaN(lastNum)) {
          nextRunningNum = lastNum + 1;
        }
      }
      const newIndexNumber = `${batchPrefix}${nextRunningNum.toString().padStart(4, '0')}`;
      
      // Generate unique QR code token
      const qrToken = `QR-${newIndexNumber}-${Math.random().toString(36).substring(2, 10)}`;

      // Fetch subjects to calculate total fee
      const subjects = await tx.subject.findMany({
        where: { id: { in: regData.selectedCourseIds } },
        select: { feeAmount: true }
      });
      const totalFeeAmount = subjects.reduce((sum, s) => sum + Number(s.feeAmount), 0);

      // Create Student with approvalStatus = PENDING
      const student = await tx.student.create({
        data: {
          userId: user.id,
          parentId,
          streamId: regData.selectedStreamId,
          indexNumber: newIndexNumber,
          nic: regData.nic || null,
          qrCode: qrToken,
          dateOfBirth: new Date(regData.dateOfBirth),
          address: regData.address,
          phone: regData.phone,
          gender: regData.gender === 'MALE' ? 'MALE' : regData.gender === 'FEMALE' ? 'FEMALE' : 'OTHER',
          school: regData.school || null,
          batch: regData.alExamBatch,
          batchId: regData.batchId || null,
          approvalStatus: 'PENDING',
          paymentStatus: 'PENDING',
          totalFeeAmount: totalFeeAmount,
          feeEffectiveDate: new Date(),
          lastFeeUpdateDate: new Date(),
        },
      });

      // Create corresponding QRCode record
      await tx.qRCode.create({
        data: {
          studentId: student.id,
          qrToken: qrToken,
        }
      });

      // Create Enrollments
      for (const subjectId of regData.selectedCourseIds) {
        const teacherId = regData.selectedTeacherIds?.[subjectId];
        if (!teacherId) throw new AppError(`Missing teacher for subject ${subjectId}`, 400);
        
        await tx.enrollment.create({
          data: {
            studentId: student.id,
            subjectId,
            teacherId,
            enrollmentStatus: 'ACTIVE',
          },
        });
      }

      return { user, student };
    });

    // Delete OTP record after successful registration
    await prisma.otpVerification.delete({
      where: { email: dto.email },
    });

    // Notify Teachers about student assignment
    try {
      const studentId = result.student.id;
      const enrollments = await prisma.enrollment.findMany({
        where: { studentId, enrollmentStatus: 'ACTIVE' },
        include: { teacher: true }
      });
      
      for (const enrollment of enrollments) {
        if (enrollment.teacher) {
          const teacherUserId = enrollment.teacher.userId;
          const studentName = result.user.fullName;
          const batchName = result.student.batch || 'Class';
          
          await notificationService.createNotification({
            senderId: result.user.id,
            receiverId: teacherUserId,
            title: 'New Student Assigned',
            message: `${studentName} joined Batch ${batchName}.`,
            type: 'STUDENT_ENROLLMENT',
            referenceType: 'ENROLLMENT',
            referenceId: enrollment.id,
          });
        }
      }
    } catch (err) {
      console.error('Failed to trigger notifications for student registration enrollments:', err);
    }

    return result;
  }
}
