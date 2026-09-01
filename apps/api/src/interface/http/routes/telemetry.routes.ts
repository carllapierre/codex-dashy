import type { FastifyInstance } from 'fastify';
import { TelemetryConversationController } from '../controllers/telemetry-conversation.controller';
import { TelemetryOverviewController } from '../controllers/telemetry-overview.controller';

export async function registerTelemetryRoutes(
    app: FastifyInstance,
    controller: TelemetryOverviewController,
    conversationController: TelemetryConversationController,
): Promise<void> {
    app.get('/api/telemetry/overview', controller.handle);
    app.get('/api/telemetry/conversations/:id', conversationController.handle);
}
