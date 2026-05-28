import { Request, Response, NextFunction } from 'express';
import { HealthService } from '../service/health.service';

export async function liveness(req: Request, res: Response, next: NextFunction) {
  try {
    const health = await HealthService.liveness();
    res.status(200).json({ success: true, data: health });
  } catch (error) {
    next(error);
  }
}

export async function readiness(req: Request, res: Response, next: NextFunction) {
  try {
    const health = await HealthService.readiness();
    const statusCode = health.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      success: health.status === 'healthy',
      data: health,
    });
  } catch (error) {
    next(error);
  }
}

export async function version(req: Request, res: Response, next: NextFunction) {
  try {
    const versionInfo = await HealthService.version();
    res.status(200).json({ success: true, data: versionInfo });
  } catch (error) {
    next(error);
  }
}

export default {
  liveness,
  readiness,
  version,
};