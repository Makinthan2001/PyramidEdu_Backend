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
exports.ManagerController = void 0;
const manager_service_1 = require("../service/manager.service");
const AppError_1 = require("../../../utils/AppError");
const client_1 = require("@prisma/client");
class ManagerController {
    static getRegisteredStudents(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield manager_service_1.ManagerService.getRegisteredStudents();
                res.status(200).json({ success: true, data });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getRegisteredStudentById(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const data = yield manager_service_1.ManagerService.getRegisteredStudentById(id);
                res.status(200).json({ success: true, data });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static updatePaymentStatus(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { paymentStatus } = req.body;
                if (!Object.values(client_1.RegistrationPaymentStatus).includes(paymentStatus)) {
                    throw new AppError_1.AppError('Invalid payment status.', 400);
                }
                const data = yield manager_service_1.ManagerService.updatePaymentStatus(id, paymentStatus);
                res.status(200).json({ success: true, message: 'Payment status updated successfully.', data });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static updateApprovalStatus(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { approvalStatus } = req.body;
                if (!Object.values(client_1.ApprovalStatus).includes(approvalStatus)) {
                    throw new AppError_1.AppError('Invalid approval status.', 400);
                }
                const data = yield manager_service_1.ManagerService.updateApprovalStatus(id, approvalStatus);
                res.status(200).json({ success: true, message: 'Approval status updated successfully.', data });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.ManagerController = ManagerController;
exports.default = ManagerController;
