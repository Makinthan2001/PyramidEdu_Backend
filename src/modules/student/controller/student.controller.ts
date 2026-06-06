import { Request, Response, NextFunction } from 'express';
import { StudentService } from '../service/student.service';
import type { InitiateRegistrationDto, VerifyOtpDto, ResendOtpDto } from '../dto';

export async function initiateRegistration(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = req.body as InitiateRegistrationDto;
    const result = await StudentService.initiateRegistration(dto);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
}

export async function resendOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = req.body as ResendOtpDto;
    const result = await StudentService.resendOtp(dto.email);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyOtpAndRegister(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = req.body as VerifyOtpDto;
    const result = await StudentService.verifyOtpAndRegister(dto);

    // We generate a regNumber just for display purposes
    const regNumber = `PE-${result.student.streamId?.slice(0, 3).toUpperCase() || 'GEN'}-${Math.floor(1000 + Math.random() * 9000)}`;

    res.status(201).json({
      success: true,
      message: 'Registration completed successfully. Waiting for manager approval.',
      data: {
        userId: result.user.id,
        studentId: result.student.id,
        regNumber,
      },
    });
  } catch (error) {
    next(error);
  }
}
