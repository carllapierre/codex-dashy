import type {
    OtlpBatch,
    OtlpBatchRepository,
    OtlpLogsDecoder,
} from '../../domain/telemetry/otel-batch';

export type IngestOtelLogsResult = {
    accepted: boolean;
    eventCount: number;
    eventNames: string[];
    conversationIds: string[];
    models: string[];
    projectCandidates: string[];
};

export class IngestOtelLogsUseCase {
    public constructor(
        private readonly decoder: OtlpLogsDecoder,
        private readonly repository: OtlpBatchRepository,
    ) {}

    public execute(payload: unknown, receivedAt = new Date()): IngestOtelLogsResult {
        const batch: OtlpBatch = this.decoder.decode(payload, receivedAt);
        const accepted = this.repository.save(batch);

        return {
            accepted,
            eventCount: batch.eventCount,
            eventNames: batch.eventNames,
            conversationIds: batch.conversationIds,
            models: batch.models,
            projectCandidates: batch.projectCandidates,
        };
    }
}
