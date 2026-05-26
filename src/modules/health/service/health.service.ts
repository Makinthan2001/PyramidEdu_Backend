import prisma from '../../../config/prisma.config';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  environment: string;
}

export interface ReadinessStatus extends HealthStatus {
  database: 'connected' | 'disconnected';
  redis?: 'connected' | 'disconnected';
}

export interface VersionInfo {
  status: 'ok';
  version: string;
  name: string;
  environment: string;
  timestamp: string;
}

/**
 * Health Service - Manages health checks and monitoring
 */
export class HealthService {
  /**
   * Liveness Check - Confirms API process is running
   */
  static async liveness(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  }

  /**
   * Readiness Check - Confirms database and Redis connections
   */
  static async readiness(): Promise<ReadinessStatus> {
    const timestamp = new Date().toISOString();
    let dbStatus: 'connected' | 'disconnected' = 'disconnected';
    let redisStatus: 'connected' | 'disconnected' = 'disconnected';

    // Check PostgreSQL connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch (error) {
      console.error('Database connection check failed:', error);
    }

    // Check Redis connection (placeholder - implement when Redis is added)
    // For now, we'll just mark it as optional
    try {
      // TODO: Implement Redis connection check when Redis is integrated
      // redisStatus = 'connected';
    } catch (error) {
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
  }

  /**
   * Version Check - Returns API version and build information
   */
  static async version(): Promise<VersionInfo> {
    const packageJson = require('../../../../package.json');

    return {
      status: 'ok',
      version: packageJson.version || '1.0.0',
      name: packageJson.name || 'PyramidEdu API',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    };
  }
}

export default HealthService;
