import type { ModelRateQueryRepository } from '../../domain/settings/model-rate';
import type { TelemetryConversation } from '../../domain/telemetry/telemetry-overview';
import type { TelemetryProjectionQueryRepository } from '../../domain/telemetry/telemetry-projection';
import { toTelemetryConversation } from './telemetry-usage-mappers';

export class GetTelemetryConversationUseCase {
    public constructor(
        private readonly repository: TelemetryProjectionQueryRepository,
        private readonly modelRateRepository: ModelRateQueryRepository,
    ) {}

    public execute(conversationId: string): TelemetryConversation | null {
        const projection = this.repository.getConversationProjection(conversationId);
        if (!projection) {
            return null;
        }

        const rates = new Map(
            this.modelRateRepository
                .listModelRates()
                .map((rate) => [rate.model.toLowerCase(), rate] as const),
        );

        return toTelemetryConversation(projection, rates);
    }
}
