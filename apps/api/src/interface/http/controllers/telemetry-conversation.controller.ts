import type { FastifyReply, FastifyRequest } from 'fastify';
import { GetTelemetryConversationUseCase } from '../../../application/telemetry/get-telemetry-conversation.use-case';

type ConversationParams = {
    id: string;
};

export class TelemetryConversationController {
    public constructor(private readonly getConversation: GetTelemetryConversationUseCase) {}

    public handle = async (
        request: FastifyRequest<{ Params: ConversationParams }>,
        reply: FastifyReply,
    ): Promise<void> => {
        const conversation = this.getConversation.execute(request.params.id);

        if (!conversation) {
            return reply.code(404).send({ error: 'Conversation not found' });
        }

        return reply.send(conversation);
    };
}
