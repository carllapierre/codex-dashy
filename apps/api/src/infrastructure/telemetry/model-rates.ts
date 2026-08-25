export type ModelRate = {
    inputPerMillionUsd: number;
    cachedInputPerMillionUsd: number;
    outputPerMillionUsd: number;
};

const MODEL_RATES: Record<string, ModelRate> = {
    'gpt-5.6-sol': {
        inputPerMillionUsd: 4,
        cachedInputPerMillionUsd: 0.4,
        outputPerMillionUsd: 20,
    },
    'gpt-5.6-terra': {
        inputPerMillionUsd: 2,
        cachedInputPerMillionUsd: 0.2,
        outputPerMillionUsd: 12,
    },
    'gpt-5.6-luna': {
        inputPerMillionUsd: 0.2,
        cachedInputPerMillionUsd: 0.02,
        outputPerMillionUsd: 1.2,
    },
    'gpt-5.5': {
        inputPerMillionUsd: 5,
        cachedInputPerMillionUsd: 0.5,
        outputPerMillionUsd: 30,
    },
    'gpt-5.4': {
        inputPerMillionUsd: 2.5,
        cachedInputPerMillionUsd: 0.25,
        outputPerMillionUsd: 15,
    },
    'gpt-5.4-mini': {
        inputPerMillionUsd: 0.75,
        cachedInputPerMillionUsd: 0.075,
        outputPerMillionUsd: 4.5,
    },
    'gpt-5.3-codex': {
        inputPerMillionUsd: 1.75,
        cachedInputPerMillionUsd: 0.175,
        outputPerMillionUsd: 14,
    },
    'gpt-5.2': {
        inputPerMillionUsd: 1.75,
        cachedInputPerMillionUsd: 0.175,
        outputPerMillionUsd: 14,
    },
};

export function getModelRate(model: string | null): ModelRate | null {
    if (!model) {
        return null;
    }

    return MODEL_RATES[model.toLowerCase()] ?? null;
}

export function calculateEstimatedCostUsd(
    model: string | null,
    inputTokens: number,
    cachedInputTokens: number,
    outputTokens: number,
): number | null {
    const rate = getModelRate(model);

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
