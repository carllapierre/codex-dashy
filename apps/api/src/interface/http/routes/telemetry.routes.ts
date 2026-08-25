import type { FastifyInstance } from 'fastify';
import { TelemetryOverviewController } from '../controllers/telemetry-overview.controller';

export async function registerTelemetryRoutes(
    app: FastifyInstance,
    controller: TelemetryOverviewController,
): Promise<void> {
    app.get('/api/telemetry/overview', controller.handle);
}
