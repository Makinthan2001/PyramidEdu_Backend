# Health Module - System Health Checks

Provides system health check endpoints for uptime monitoring, CI/CD pipeline validation, and operational visibility. Confirms API liveness, database connectivity, and Redis availability.

## Directory Structure

```
modules/health/
├── controller/
│   └── health.controller.ts          # HTTP request handlers
├── service/
│   └── health.service.ts             # Health check logic
├── routes/
│   └── health.routes.ts              # API endpoint definitions
├── README.md                         # This file
└── index.ts                          # Module export
```

## Features

### 1. Liveness Check (`/api/v1/health`)

- **Purpose**: Confirms API process is running
- **HTTP Status**: 200 OK
- **Response Time**: < 100ms
- **Authentication**: Not required
- **Caching**: Can be safely cached by load balancers
- **Use Case**: Load balancer health probes, uptime monitoring

**Response Example:**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-05-26T10:30:00.000Z",
    "uptime": 3600,
    "environment": "production"
  }
}
```

### 2. Readiness Check (`/api/v1/health/ready`)

- **Purpose**: Confirms database and Redis connections are active
- **HTTP Status**: 200 OK (healthy) or 503 Service Unavailable (unhealthy)
- **Authentication**: Not required
- **Dependencies Checked**:
  - PostgreSQL database connectivity
  - Redis connection (when integrated)
- **Use Case**: Kubernetes readiness probes, deployment validation, CI/CD pipelines

**Healthy Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-05-26T10:30:00.000Z",
    "uptime": 3600,
    "environment": "production",
    "database": "connected",
    "redis": "connected"
  }
}
```

**Unhealthy Response (503 Service Unavailable):**

```json
{
  "success": false,
  "data": {
    "status": "unhealthy",
    "timestamp": "2026-05-26T10:30:00.000Z",
    "uptime": 3600,
    "environment": "production",
    "database": "disconnected",
    "redis": "disconnected"
  }
}
```

### 3. Version Check (`/api/v1/health/version`)

- **Purpose**: Returns API version and build information
- **HTTP Status**: 200 OK
- **Authentication**: Not required (can be protected in production)
- **Information Returned**:
  - API version (from package.json)
  - API name
  - Environment
  - Timestamp
- **Use Case**: Version validation, deployment confirmation, CI/CD integration

**Response Example:**

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "version": "1.0.0",
    "name": "PyramidEdu API",
    "environment": "production",
    "timestamp": "2026-05-26T10:30:00.000Z"
  }
}
```

## API Endpoints

| Method | Path                     | Description     | Auth Required | Response Status |
| ------ | ------------------------ | --------------- | ------------- | --------------- |
| GET    | `/api/v1/health`         | Liveness check  | No            | 200             |
| GET    | `/api/v1/health/ready`   | Readiness check | No            | 200 or 503      |
| GET    | `/api/v1/health/version` | Version info    | No            | 200             |

## Usage Examples

### cURL Commands

**Liveness Check:**

```bash
curl http://localhost:3000/api/v1/health
```

**Readiness Check:**

```bash
curl http://localhost:3000/api/v1/health/ready
```

**Version Check:**

```bash
curl http://localhost:3000/api/v1/health/version
```

### Kubernetes Configuration

**Deployment Manifest:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pyramidedu-api
spec:
  template:
    spec:
      containers:
        - name: api
          image: pyramidedu-api:latest
          livenessProbe:
            httpGet:
              path: /api/v1/health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 30
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /api/v1/health/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
```

### Docker Healthcheck

**Dockerfile:**

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000
CMD ["npm", "start"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1
```

### CI/CD Integration

**GitHub Actions Example:**

```yaml
- name: Check API Health
  run: |
    npm start &
    sleep 5
    curl -f http://localhost:3000/api/v1/health || exit 1
    curl -f http://localhost:3000/api/v1/health/ready || exit 1
    curl -f http://localhost:3000/api/v1/health/version || exit 1
```

## Monitoring Integration

### Prometheus Scrape Config

```yaml
scrape_configs:
  - job_name: "pyramidedu-api"
    static_configs:
      - targets: ["localhost:3000"]
    metrics_path: "/api/v1/health"
```

### Health Dashboard Queries

**Uptime (in seconds):**

```
SELECT data->'uptime' FROM health_checks ORDER BY timestamp DESC LIMIT 1
```

**Database Status:**

```
SELECT data->'database' FROM health_checks ORDER BY timestamp DESC LIMIT 1
```

## Error Handling

### Possible Error Scenarios

| Scenario                        | Status | Response                             |
| ------------------------------- | ------ | ------------------------------------ |
| API running, DB connected       | 200    | Healthy                              |
| API running, DB disconnected    | 503    | Unhealthy                            |
| API running, Redis disconnected | 503    | Unhealthy (when Redis is integrated) |
| Internal server error           | 500    | Error details                        |

## Performance Considerations

### Response Times

- **Liveness Check**: < 10ms (no external calls)
- **Readiness Check**: 50-200ms (includes DB ping)
- **Version Check**: < 5ms (static data from package.json)

### Best Practices

1. **Caching**: Don't cache readiness checks; they need real-time status
2. **Rate Limiting**: Health endpoints should NOT be rate-limited
3. **Monitoring**: Log all health check failures for debugging
4. **Frequency**: Liveness probes every 30s, readiness probes every 10s (Kubernetes defaults)

## Security

### Authentication

- ✅ **No authentication required** for any health endpoints
- **Rationale**: Health checks must be accessible for monitoring systems
- **Production Consideration**: The `/version` endpoint can optionally be protected in production to hide version information from public API discovery

### CORS & HTTPS

- Health endpoints respect CORS configuration
- Recommended: HTTPS only in production
- Can be accessed from monitoring dashboards and external monitoring services

## Future Enhancements

1. **Metrics Endpoints**: Add `/metrics` for Prometheus integration
2. **Cache Status**: Add Redis cache hit/miss rates
3. **Request Queue**: Add request queue depth monitoring
4. **Custom Checks**: Add custom application-specific health checks
5. **Historical Data**: Store health check history for trend analysis
6. **Alerting**: Integrate with alerting systems (PagerDuty, Slack, etc.)

## Implementation Notes

### Database Health Check

```typescript
// Performs a simple SELECT 1 query
await prisma.$queryRaw`SELECT 1`;
```

### Redis Health Check (Placeholder)

Currently a placeholder. Will be implemented when Redis is integrated:

```typescript
// TODO: Implement when Redis is added
// client.ping()
```

### Version Information

Reads from `package.json`:

```typescript
const packageJson = require("../../../../package.json");
const version = packageJson.version;
const name = packageJson.name;
```

## Troubleshooting

### Readiness Check Returns 503

**Possible Causes:**

1. Database connection lost
2. Redis connection lost (when integrated)
3. Database query timeout

**Solution:**

1. Check database connection string in `.env`
2. Verify database is running and accessible
3. Check database credentials
4. Review database logs for connection errors

### Version Endpoint Returns Error

**Possible Causes:**

1. package.json not found
2. Malformed package.json

**Solution:**

1. Verify package.json exists in project root
2. Validate JSON syntax in package.json

## Related Documentation

- [Health Monitoring Best Practices](https://12factor.net/disposability)
- [Kubernetes Probes Documentation](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [Health Check Patterns](https://microservices.io/patterns/observability/health-check-api.html)
