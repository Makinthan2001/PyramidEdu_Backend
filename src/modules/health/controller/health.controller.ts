import { Request, Response, NextFunction } from 'express';
import { HealthService } from '../service/health.service';
import { AppError } from '../../../utils/AppError';

/**
 * Health Controller - Handles health check endpoints
 */

/**
 * GET /api/v1/health
 * Liveness check - confirms API process is running
 */
export async function liveness(req: Request, res: Response, next: NextFunction) {
  try {
    const health = await HealthService.liveness();
    res.status(200).json({
      success: true,
      data: health,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/health/ready
 * Readiness check - confirms database and Redis connections
 * Returns 503 Service Unavailable if any dependency is down
 */
export async function readiness(req: Request, res: Response, next: NextFunction) {
  try {
    const health = await HealthService.readiness();

    // Return 503 if system is not ready
    const statusCode = health.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      success: health.status === 'healthy',
      data: health,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/health/version
 * Version check - returns API version and build information
 * No authentication required (can be protected in production)
 */
export async function version(req: Request, res: Response, next: NextFunction) {
  try {
    const versionInfo = await HealthService.version();
    res.status(200).json({
      success: true,
      data: versionInfo,
    });
  } catch (error) {
    next(error);
  }
}

export default {
  liveness,
  readiness,
  version,
};
