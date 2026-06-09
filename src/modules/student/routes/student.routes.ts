import { Router } from 'express';
import { validate } from '../../../middleware/validate';
import * as controller from '../controller/student.controller';
import { initiateRegistrationSchema, verifyOtpSchema, resendOtpSchema } from '../validators/student.validator';

const router = Router();

// Public endpoints
router.post('/register/initiate', validate(initiateRegistrationSchema), controller.initiateRegistration);
router.post('/register/resend-otp', validate(resendOtpSchema), controller.resendOtp);
router.post('/register/verify', validate(verifyOtpSchema), controller.verifyOtpAndRegister);

export default router;
