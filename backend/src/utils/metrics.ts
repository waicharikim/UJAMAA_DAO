// src/utils/metrics.ts
import client from 'prom-client';

client.collectDefaultMetrics();

export const attachUserRolesDbErrors = new client.Counter({
  name: 'attach_user_roles_db_errors_total',
  help: 'attachUserRoles DB error count',
});

export const attachUserRolesJwtRejected = new client.Counter({
  name: 'attach_user_roles_jwt_rejected_total',
  help: 'attachUserRoles rejected JWT roles count',
});

export const attachUserRolesDuration = new client.Histogram({
  name: 'attach_user_roles_duration_seconds',
  help: 'attachUserRoles duration in seconds',
  buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
});

export function metricsHandler(req: any, res: any) {
  res.setHeader('Content-Type', client.register.contentType);
  client.register.metrics().then((m) => res.end(m)).catch((err) => {
    res.status(500).end(err?.message ?? 'metrics error');
  });
}