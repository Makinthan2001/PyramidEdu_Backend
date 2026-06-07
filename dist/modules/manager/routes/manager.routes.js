"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const manager_controller_1 = require("../controller/manager.controller");
const authenticate_1 = require("../../../middleware/authenticate");
const authorize_1 = require("../../../middleware/authorize");
const router = (0, express_1.Router)();
// All manager routes require authentication and manager/admin role
router.use(authenticate_1.authenticate, authorize_1.adminOrManager);
router.get('/registered-students', manager_controller_1.ManagerController.getRegisteredStudents);
router.get('/registered-students/:id', manager_controller_1.ManagerController.getRegisteredStudentById);
router.patch('/registered-students/:id/payment-status', manager_controller_1.ManagerController.updatePaymentStatus);
router.patch('/registered-students/:id/approval-status', manager_controller_1.ManagerController.updateApprovalStatus);
exports.default = router;
