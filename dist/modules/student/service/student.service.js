"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentService = void 0;
const prisma_config_1 = __importDefault(require("../../../config/prisma.config"));
const AppError_1 = require("../../../utils/AppError");
const password_util_1 = require("../../../utils/password.util");
const client_1 = require("@prisma/client");
const email_util_1 = require("../../../utils/email.util");
class StudentService {
    static initiateRegistration(dto) {
        return __awaiter(this, void 0, void 0, function* () {
            const existingUser = yield prisma_config_1.default.user.findUnique({
                where: { email: dto.email },
            });
            if (existingUser) {
                throw new AppError_1.AppError('Email is already registered.', 400);
            }
            if (dto.nic) {
                const existingStudent = yield prisma_config_1.default.student.findUnique({
                    where: { nic: dto.nic },
                });
                if (existingStudent) {
                    throw new AppError_1.AppError('NIC is already registered.', 400);
                }
            }
            if (dto.selectedCourseIds.length < 1 || dto.selectedCourseIds.length > 3) {
                throw new AppError_1.AppError('Please select between 1 and 3 subjects.', 400);
            }
            // Ensure all subjects have an assigned teacher
            for (const subjectId of dto.selectedCourseIds) {
                if (!dto.selectedTeacherIds[subjectId]) {
                    throw new AppError_1.AppError(`Teacher not selected for subject: ${subjectId}`, 400);
                }
            }
            // Generate 6 digit OTP
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
            // Store in OtpVerification
            const payload = JSON.stringify(dto);
            yield prisma_config_1.default.otpVerification.upsert({
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
            yield (0, email_util_1.sendEmail)(dto.email, emailSubject, emailHtml);
            return { message: 'OTP generated and sent successfully.' };
        });
    }
    static resendOtp(email) {
        return __awaiter(this, void 0, void 0, function* () {
            const existingOtpRecord = yield prisma_config_1.default.otpVerification.findUnique({
                where: { email },
            });
            if (!existingOtpRecord) {
                throw new AppError_1.AppError('No pending registration found for this email.', 404);
            }
            const dto = typeof existingOtpRecord.data === 'string'
                ? JSON.parse(existingOtpRecord.data)
                : existingOtpRecord.data;
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
            yield prisma_config_1.default.otpVerification.update({
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
            yield (0, email_util_1.sendEmail)(email, emailSubject, emailHtml);
            return { message: 'A new OTP has been sent to your email.' };
        });
    }
    static verifyOtpAndRegister(dto) {
        return __awaiter(this, void 0, void 0, function* () {
            const otpRecord = yield prisma_config_1.default.otpVerification.findUnique({
                where: { email: dto.email },
            });
            if (!otpRecord) {
                throw new AppError_1.AppError('Invalid email or OTP request expired.', 400);
            }
            if (otpRecord.otpCode !== dto.otpCode) {
                throw new AppError_1.AppError('Invalid OTP code.', 400);
            }
            if (new Date() > otpRecord.expiresAt) {
                throw new AppError_1.AppError('OTP has expired. Please request a new one.', 400);
            }
            const payload = otpRecord.data;
            if (!payload) {
                throw new AppError_1.AppError('Registration data is missing or corrupted.', 500);
            }
            const regData = typeof payload === 'string' ? JSON.parse(payload) : payload;
            const existingUser = yield prisma_config_1.default.user.findUnique({
                where: { email: regData.email },
            });
            if (existingUser) {
                throw new AppError_1.AppError('Email is already registered.', 400);
            }
            // Start transaction to create User, Student, Parent, and Enrollments
            const result = yield prisma_config_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const hashedPassword = yield (0, password_util_1.hashPassword)(regData.password);
                // Create Parent if needed
                let parentId = undefined;
                if (regData.parentName) {
                    const parent = yield tx.parent.create({
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
                const user = yield tx.user.create({
                    data: {
                        fullName: `${regData.firstName} ${regData.lastName}`,
                        email: regData.email,
                        password: hashedPassword,
                        phone: regData.phone,
                        role: client_1.Role.STUDENT,
                        status: client_1.UserStatus.PENDING,
                        isActive: true, // They can log in, but app will restrict them if status=PENDING
                    },
                });
                // Calculate the next indexNumber
                const batchPrefix = `STD${regData.alExamBatch}`;
                const latestStudent = yield tx.student.findFirst({
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
                const subjects = yield tx.subject.findMany({
                    where: { id: { in: regData.selectedCourseIds } },
                    select: { feeAmount: true }
                });
                const totalFeeAmount = subjects.reduce((sum, s) => sum + Number(s.feeAmount), 0);
                // Create Student with approvalStatus = PENDING
                const student = yield tx.student.create({
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
                        approvalStatus: 'PENDING',
                        paymentStatus: 'PENDING',
                        totalFeeAmount: totalFeeAmount,
                        feeEffectiveDate: new Date(),
                        lastFeeUpdateDate: new Date(),
                    },
                });
                // Create corresponding QRCode record
                yield tx.qRCode.create({
                    data: {
                        studentId: student.id,
                        qrToken: qrToken,
                    }
                });
                // Create Enrollments
                for (const subjectId of regData.selectedCourseIds) {
                    const teacherId = (_a = regData.selectedTeacherIds) === null || _a === void 0 ? void 0 : _a[subjectId];
                    if (!teacherId)
                        throw new AppError_1.AppError(`Missing teacher for subject ${subjectId}`, 400);
                    yield tx.enrollment.create({
                        data: {
                            studentId: student.id,
                            subjectId,
                            teacherId,
                            enrollmentStatus: 'ACTIVE',
                        },
                    });
                }
                return { user, student };
            }));
            // Delete OTP record after successful registration
            yield prisma_config_1.default.otpVerification.delete({
                where: { email: dto.email },
            });
            return result;
        });
    }
}
exports.StudentService = StudentService;
