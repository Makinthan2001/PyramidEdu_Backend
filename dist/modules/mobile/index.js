"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = __importDefault(require("./auth"));
const health_1 = __importDefault(require("./health"));
const exam_1 = __importDefault(require("./exam"));
const notification_routes_1 = __importDefault(require("./notification/notification.routes"));
const router = (0, express_1.Router)();
router.use('/auth', auth_1.default);
router.use('/health', health_1.default);
router.use('/exams', exam_1.default);
router.use('/notifications', notification_routes_1.default);
exports.default = router;
