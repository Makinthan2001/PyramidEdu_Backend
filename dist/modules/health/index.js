"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthService = void 0;
const health_routes_1 = __importDefault(require("./routes/health.routes"));
var health_service_1 = require("./service/health.service");
Object.defineProperty(exports, "HealthService", { enumerable: true, get: function () { return health_service_1.HealthService; } });
exports.default = health_routes_1.default;
