import type {
    ModelRate,
    ModelRateRepository,
    ModelRateValues,
} from '../../domain/settings/model-rate';

export class InvalidModelRateError extends Error {}

function readNonNegativeNumber(value: unknown, field: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new InvalidModelRateError(`${field} must be a non-negative number`);
    }

    return value;
}

export class UpdateModelRateUseCase {
    public constructor(private readonly repository: ModelRateRepository) {}

    public execute(model: string, input: Partial<ModelRateValues>): ModelRate {
        const normalizedModel = model.trim().toLowerCase();

        if (!normalizedModel) {
            throw new InvalidModelRateError('model is required');
        }

        return this.repository.updateModelRate(normalizedModel, {
            inputPerMillionUsd: readNonNegativeNumber(
                input.inputPerMillionUsd,
                'inputPerMillionUsd',
            ),
            cachedInputPerMillionUsd: readNonNegativeNumber(
                input.cachedInputPerMillionUsd,
                'cachedInputPerMillionUsd',
            ),
            outputPerMillionUsd: readNonNegativeNumber(
                input.outputPerMillionUsd,
                'outputPerMillionUsd',
            ),
        });
    }
}
