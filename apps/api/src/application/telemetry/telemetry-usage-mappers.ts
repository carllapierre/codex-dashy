import type { ModelRate } from '../../domain/settings/model-rate';
import type { TelemetryConversation } from '../../domain/telemetry/telemetry-overview';
import type {
    TelemetryConversationProjection,
    TelemetryUsageBucket,
} from '../../domain/telemetry/telemetry-projection';
import { calculateEstimatedCostUsd } from '../../infrastructure/telemetry/model-rates';

export type UsageTotals = {
    model: string | null;
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    toolTokens: number;
    completedResponses: number;
    ttftTotalMs: number;
    ttftCount: number;
    estimatedCostUsd: number;
    hasUnknownRate: boolean;
    unpricedModels: string[];
};

export function createUsageTotals(): UsageTotals {
    return {
        model: null,
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        toolTokens: 0,
        completedResponses: 0,
        ttftTotalMs: 0,
        ttftCount: 0,
        estimatedCostUsd: 0,
        hasUnknownRate: false,
        unpricedModels: [],
    };
}

export function addUsageBucket(
    totals: UsageTotals,
    bucket: TelemetryUsageBucket,
    rates: ReadonlyMap<string, ModelRate>,
): void {
    totals.model ??= bucket.model;
    totals.inputTokens += bucket.inputTokens;
    totals.cachedInputTokens += bucket.cachedInputTokens;
    totals.outputTokens += bucket.outputTokens;
    totals.reasoningTokens += bucket.reasoningTokens;
    totals.toolTokens += bucket.toolTokens;
    totals.completedResponses += bucket.completedResponses;
    totals.ttftTotalMs += bucket.ttftTotalMs;
    totals.ttftCount += bucket.ttftCount;

    const rate = bucket.model ? (rates.get(bucket.model.toLowerCase()) ?? null) : null;
    const cost = calculateEstimatedCostUsd(
        rate,
        bucket.inputTokens,
        bucket.cachedInputTokens,
        bucket.outputTokens,
    );
    if (cost === null && bucket.inputTokens + bucket.outputTokens > 0) {
        totals.hasUnknownRate = true;
        if (bucket.model && !totals.unpricedModels.includes(bucket.model)) {
            totals.unpricedModels.push(bucket.model);
        }
    } else if (cost !== null) {
        totals.estimatedCostUsd += cost;
    }
}

export function toCost(totals: UsageTotals): number | null {
    if (totals.inputTokens + totals.outputTokens === 0 || totals.hasUnknownRate) {
        return null;
    }

    return totals.estimatedCostUsd;
}

export function toAverageTtft(ttftTotalMs: number, ttftCount: number): number | null {
    return ttftCount > 0 ? ttftTotalMs / ttftCount : null;
}

export function toTelemetryConversation(
    projection: TelemetryConversationProjection,
    rates: ReadonlyMap<string, ModelRate>,
): TelemetryConversation {
    const totals = createUsageTotals();
    for (const bucket of projection.usageBuckets) {
        addUsageBucket(totals, bucket, rates);
    }

    return {
        id: projection.id,
        initialPrompt: projection.initialPrompt,
        prompts: projection.prompts,
        startedAt: projection.startedAt,
        lastActivityAt: projection.lastActivityAt,
        model: projection.model,
        reasoningEfforts: projection.reasoningEfforts,
        inputTokens: projection.inputTokens,
        cachedInputTokens: projection.cachedInputTokens,
        outputTokens: projection.outputTokens,
        reasoningTokens: projection.reasoningTokens,
        toolTokens: projection.toolTokens,
        totalTokens: projection.inputTokens + projection.outputTokens,
        estimatedCostUsd: toCost(totals),
        unpricedModels: totals.unpricedModels,
        completedResponses: projection.completedResponses,
        averageTtftMs: toAverageTtft(projection.ttftTotalMs, projection.ttftCount),
    };
}
