import healthRoutes from './routes/health.routes';

export { HealthService } from './service/health.service';
export type { HealthStatus, ReadinessStatus, VersionInfo } from './service/health.service';

export default healthRoutes;
