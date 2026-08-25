import type { ModelRateValues } from '../../domain/settings/model-rate';

export function calculateEstimatedCostUsd(
    rate: ModelRateValues | null,
    inputTokens: number,
    cachedInputTokens: number,
    outputTokens: number,
): number | null {
    if (!rate) {
        return null;
    }

    const uncachedInputTokens = Math.max(inputTokens - cachedInputTokens, 0);

    return (
        (uncachedInputTokens * rate.inputPerMillionUsd +
            cachedInputTokens * rate.cachedInputPerMillionUsd +
            outputTokens * rate.outputPerMillionUsd) /
        1_000_000
    );
}
