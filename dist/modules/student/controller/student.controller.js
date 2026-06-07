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
Object.defineProperty(exports, "__esModule", { value: true });
exports.initiateRegistration = initiateRegistration;
exports.resendOtp = resendOtp;
exports.verifyOtpAndRegister = verifyOtpAndRegister;
const student_service_1 = require("../service/student.service");
function initiateRegistration(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const dto = req.body;
            const result = yield student_service_1.StudentService.initiateRegistration(dto);
            res.status(200).json({
                success: true,
                message: result.message,
            });
        }
        catch (error) {
            next(error);
        }
    });
}
function resendOtp(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const dto = req.body;
            const result = yield student_service_1.StudentService.resendOtp(dto.email);
            res.status(200).json({
                success: true,
                message: result.message,
            });
        }
        catch (error) {
            next(error);
        }
    });
}
function verifyOtpAndRegister(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const dto = req.body;
            const result = yield student_service_1.StudentService.verifyOtpAndRegister(dto);
            // We generate a regNumber just for display purposes
            const regNumber = `PE-${((_a = result.student.streamId) === null || _a === void 0 ? void 0 : _a.slice(0, 3).toUpperCase()) || 'GEN'}-${Math.floor(1000 + Math.random() * 9000)}`;
            res.status(201).json({
                success: true,
                message: 'Registration completed successfully. Waiting for manager approval.',
                data: {
                    userId: result.user.id,
                    studentId: result.student.id,
                    regNumber,
                },
            });
        }
        catch (error) {
            console.error('VERIFY OTP ERROR:', error);
            next(error);
        }
    });
}
