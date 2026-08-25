import type { FastifyInstance } from 'fastify';
import { HealthController } from '../controllers/health.controller';

export async function registerHealthRoutes(
    app: FastifyInstance,
    controller: HealthController,
): Promise<void> {
    app.get('/api/health', controller.handle);
}
