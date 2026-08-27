import type { ModelRateValues } from '../../domain/settings/model-rate';

export const DEFAULT_MODEL_RATES: Record<string, ModelRateValues> = {
    // Internal Codex label with no public rate; use the current low-cost model as a proxy.
    'codex-auto-review': {
        inputPerMillionUsd: 0.2,
        cachedInputPerMillionUsd: 0.02,
        outputPerMillionUsd: 1.2,
    },
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
