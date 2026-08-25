import type { FastifyInstance } from 'fastify';
import { ModelRatesController } from '../controllers/model-rates.controller';

export async function registerModelRatesRoutes(
    app: FastifyInstance,
    controller: ModelRatesController,
): Promise<void> {
    app.get('/api/settings/model-rates', controller.list);
    app.put('/api/settings/model-rates/:model', controller.update);
}
