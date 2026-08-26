export type TelemetryRange = '1d' | '7d' | '30d';

export type CodexUsageWindow = {
    usedPercent?: number;
    windowDurationMins?: number;
    resetsAt?: number;
    [key: string]: unknown;
};

export type CodexUsageBucket = {
    limitId?: string;
    limitName?: string | null;
    primary?: CodexUsageWindow | null;
    secondary?: CodexUsageWindow | null;
    individualLimit?: Record<string, unknown> | null;
    planType?: string | null;
    [key: string]: unknown;
};

export type CodexUsageSnapshot = {
    available: boolean;
    fetchedAt: string | null;
    rateLimits: CodexUsageBucket | null;
    rateLimitsByLimitId: Record<string, CodexUsageBucket> | null;
    rateLimitResetCredits: Record<string, unknown> | null;
    usage: Record<string, unknown> | null;
    error: string | null;
};

export type ModelRate = {
    model: string;
    inputPerMillionUsd: number;
    cachedInputPerMillionUsd: number;
    outputPerMillionUsd: number;
    updatedAt: string;
};

export type TelemetryPrompt = {
    id: string;
    text: string;
    timestamp: string;
    model: string | null;
    characterCount: number;
};

export type TelemetryConversation = {
    id: string;
    initialPrompt: string | null;
    prompts: TelemetryPrompt[];
    startedAt: string;
    lastActivityAt: string;
    model: string | null;
    reasoningEfforts: string[];
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    toolTokens: number;
    totalTokens: number;
    estimatedCostUsd: number | null;
    unpricedModels: string[];
    completedResponses: number;
    averageTtftMs: number | null;
};

export type TelemetryOverview = {
    range: TelemetryRange;
    model: string | null;
    availableModels: string[];
    generatedAt: string;
    summary: {
        inputTokens: number;
        cachedInputTokens: number;
        outputTokens: number;
        reasoningTokens: number;
        toolTokens: number;
        totalTokens: number;
        estimatedCostUsd: number | null;
        unpricedModels: string[];
        conversationCount: number;
        completedResponses: number;
        averageTtftMs: number | null;
    };
    trend: Array<{
        startAt: string;
        label: string;
        totalTokens: number;
        estimatedCostUsd: number | null;
    }>;
    conversations: TelemetryConversation[];
};
