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
exports.liveness = liveness;
exports.readiness = readiness;
exports.version = version;
const health_service_1 = require("../service/health.service");
/**
 * Health Controller - Handles health check endpoints
 */
/**
 * GET /api/v1/health
 * Liveness check - confirms API process is running
 */
function liveness(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const health = yield health_service_1.HealthService.liveness();
            res.status(200).json({
                success: true,
                data: health,
            });
        }
        catch (error) {
            next(error);
        }
    });
}
/**
 * GET /api/v1/health/ready
 * Readiness check - confirms database and Redis connections
 * Returns 503 Service Unavailable if any dependency is down
 */
function readiness(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const health = yield health_service_1.HealthService.readiness();
            // Return 503 if system is not ready
            const statusCode = health.status === 'healthy' ? 200 : 503;
            res.status(statusCode).json({
                success: health.status === 'healthy',
                data: health,
            });
        }
        catch (error) {
            next(error);
        }
    });
}
/**
 * GET /api/v1/health/version
 * Version check - returns API version and build information
 * No authentication required (can be protected in production)
 */
function version(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const versionInfo = yield health_service_1.HealthService.version();
            res.status(200).json({
                success: true,
                data: versionInfo,
            });
        }
        catch (error) {
            next(error);
        }
    });
}
exports.default = {
    liveness,
    readiness,
    version,
};
