export type TelemetryAttribute = string | number | boolean | null;

export type NormalizedTelemetryEvent = {
    eventName: string | null;
    observedAt: string;
    conversationId: string | null;
    model: string | null;
    attributes: Record<string, TelemetryAttribute>;
};

export type OtlpBatch = {
    dedupeKey: string;
    receivedAt: string;
    eventCount: number;
    eventNames: string[];
    conversationIds: string[];
    models: string[];
    projectCandidates: string[];
    events: NormalizedTelemetryEvent[];
    sanitizedPayload: unknown;
};

export type OtlpBatchRepository = {
    save: (batch: OtlpBatch) => boolean;
};

export type OtlpLogsDecoder = {
    decode: (payload: unknown, receivedAt: Date) => OtlpBatch;
};
