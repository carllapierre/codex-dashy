import type { FastifyReply, FastifyRequest } from 'fastify';
import { IngestOtelLogsUseCase } from '../../../application/telemetry/ingest-otel-logs.use-case';

export class OtelLogsController {
    public constructor(private readonly ingestOtelLogs: IngestOtelLogsUseCase) {}

    public handle = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        const result = this.ingestOtelLogs.execute(request.body);

        request.log.info(
            {
                ...result,
                projectCandidates: result.projectCandidates.length,
            },
            'OTLP logs received',
        );

        reply.code(200).send({});
    };
}
