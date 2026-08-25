import type { FastifyInstance } from 'fastify';
import { OtelLogsController } from '../controllers/otel-logs.controller';

export async function registerOtelRoutes(
    app: FastifyInstance,
    controller: OtelLogsController,
): Promise<void> {
    app.post('/v1/logs', controller.handle);
}
