import type { TelemetryPrompt } from './telemetry-overview';

export type TelemetryUsageBucket = {
    startAt: string;
    model: string | null;
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    toolTokens: number;
    completedResponses: number;
    ttftTotalMs: number;
    ttftCount: number;
};

export type TelemetryConversationProjection = {
    id: string;
    initialPrompt: string | null;
    prompts: TelemetryPrompt[];
    startedAt: string;
    lastActivityAt: string;
    model: string | null;
    reasoningEfforts: string[];
    usageBuckets: TelemetryUsageBucket[];
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    toolTokens: number;
    completedResponses: number;
    ttftTotalMs: number;
    ttftCount: number;
};

export type TelemetryProjectionQueryRepository = {
    listUsageBuckets: (since: string, model: string | null) => TelemetryUsageBucket[];
    listConversationProjections: (
        since: string,
        model: string | null,
    ) => TelemetryConversationProjection[];
    getConversationProjection: (conversationId: string) => TelemetryConversationProjection | null;
    listAvailableModels: (since: string) => string[];
};
