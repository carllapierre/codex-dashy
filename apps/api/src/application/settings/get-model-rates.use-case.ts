import type { ModelRate, ModelRateQueryRepository } from '../../domain/settings/model-rate';

export class GetModelRatesUseCase {
    public constructor(private readonly repository: ModelRateQueryRepository) {}

    public execute(): ModelRate[] {
        return this.repository.listModelRates();
    }
}
