export type TelemetryRange = '1d' | '7d' | '30d';

export type TelemetryConversation = {
    id: string;
    initialPrompt: string | null;
    startedAt: string;
    lastActivityAt: string;
    model: string | null;
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    toolTokens: number;
    totalTokens: number;
    estimatedCostUsd: number | null;
    completedResponses: number;
    averageTtftMs: number | null;
};

export type TelemetryTrendPoint = {
    startAt: string;
    label: string;
    totalTokens: number;
    estimatedCostUsd: number | null;
};

export type TelemetrySummary = {
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    toolTokens: number;
    totalTokens: number;
    estimatedCostUsd: number | null;
    conversationCount: number;
    completedResponses: number;
    averageTtftMs: number | null;
};

export type TelemetryOverview = {
    range: TelemetryRange;
    model: string | null;
    availableModels: string[];
    generatedAt: string;
    summary: TelemetrySummary;
    trend: TelemetryTrendPoint[];
    conversations: TelemetryConversation[];
};
