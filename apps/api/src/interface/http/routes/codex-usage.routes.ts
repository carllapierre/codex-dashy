import type { FastifyInstance } from 'fastify';
import { CodexUsageController } from '../controllers/codex-usage.controller';

export async function registerCodexUsageRoutes(
    app: FastifyInstance,
    controller: CodexUsageController,
): Promise<void> {
    app.get('/api/codex/usage', controller.read);
}
