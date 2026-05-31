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
exports.HealthService = void 0;
const prisma_config_1 = __importDefault(require("../../../config/prisma.config"));
/**
 * Health Service - Manages health checks and monitoring
 */
class HealthService {
    /**
     * Liveness Check - Confirms API process is running
     */
    static liveness() {
        return __awaiter(this, void 0, void 0, function* () {
            return {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                environment: process.env.NODE_ENV || 'development',
            };
        });
    }
    /**
     * Readiness Check - Confirms database and Redis connections
     */
    static readiness() {
        return __awaiter(this, void 0, void 0, function* () {
            const timestamp = new Date().toISOString();
            let dbStatus = 'disconnected';
            let redisStatus = 'disconnected';
            // Check PostgreSQL connection
            try {
                yield prisma_config_1.default.$queryRaw `SELECT 1`;
                dbStatus = 'connected';
            }
            catch (error) {
                console.error('Database connection check failed:', error);
            }
            // Check Redis connection (placeholder - implement when Redis is added)
            // For now, we'll just mark it as optional
            try {
                // TODO: Implement Redis connection check when Redis is integrated
                // redisStatus = 'connected';
            }
            catch (error) {
                console.error('Redis connection check failed:', error);
            }
            const allHealthy = dbStatus === 'connected';
            return {
                status: allHealthy ? 'healthy' : 'unhealthy',
                timestamp,
                uptime: process.uptime(),
                environment: process.env.NODE_ENV || 'development',
                database: dbStatus,
                redis: redisStatus,
            };
        });
    }
    /**
     * Version Check - Returns API version and build information
     */
    static version() {
        return __awaiter(this, void 0, void 0, function* () {
            const packageJson = require('../../../../package.json');
            return {
                status: 'ok',
                version: packageJson.version || '1.0.0',
                name: packageJson.name || 'PyramidEdu API',
                environment: process.env.NODE_ENV || 'development',
                timestamp: new Date().toISOString(),
            };
        });
    }
}
exports.HealthService = HealthService;
exports.default = HealthService;
