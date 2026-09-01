import type Database from 'better-sqlite3';
import type { OtlpBatch, NormalizedTelemetryEvent } from '../../../domain/telemetry/otel-batch';
import {
    isTitleGenerationPrompt,
    readTelemetryNumber,
    readTelemetryString,
    readTelemetryTimestamp,
    readUserPrompt,
} from '../../../domain/telemetry/telemetry-event';

const hourMs = 60 * 60 * 1_000;

type UsageMetrics = {
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    toolTokens: number;
    completedResponses: number;
    ttftTotalMs: number;
    ttftCount: number;
};

type ConversationState = {
    startedAt: number;
    lastActivityAt: number;
    model: string | null;
    reasoningEfforts: string[];
    prompts: Array<{
        observedAt: number;
        model: string | null;
        text: string;
    }>;
};

function createMetrics(): UsageMetrics {
    return {
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        toolTokens: 0,
        completedResponses: 0,
        ttftTotalMs: 0,
        ttftCount: 0,
    };
}

function createConversationState(timestamp: number): ConversationState {
    return {
        startedAt: timestamp,
        lastActivityAt: timestamp,
        model: null,
        reasoningEfforts: [],
        prompts: [],
    };
}

function getEventTimestamp(event: NormalizedTelemetryEvent, fallback: number): number {
    return readTelemetryTimestamp(event.observedAt) ?? fallback;
}

function getBucketStart(timestamp: number): string {
    return new Date(Math.floor(timestamp / hourMs) * hourMs).toISOString();
}

function getModelKey(model: string | null): string {
    return model ?? '';
}

function addEventMetrics(metrics: UsageMetrics, event: NormalizedTelemetryEvent): void {
    if (event.eventName === 'codex.sse_event' && 'input_token_count' in event.attributes) {
        metrics.inputTokens += readTelemetryNumber(event.attributes, 'input_token_count');
        metrics.cachedInputTokens += readTelemetryNumber(event.attributes, 'cached_token_count');
        metrics.outputTokens += readTelemetryNumber(event.attributes, 'output_token_count');
        metrics.reasoningTokens += readTelemetryNumber(event.attributes, 'reasoning_token_count');
        metrics.toolTokens += readTelemetryNumber(event.attributes, 'tool_token_count');
        metrics.completedResponses += 1;
    }

    if (event.eventName === 'codex.turn_ttft') {
        const duration = readTelemetryNumber(event.attributes, 'duration_ms');

        if (duration > 0) {
            metrics.ttftTotalMs += duration;
            metrics.ttftCount += 1;
        }
    }
}

function hasMetrics(event: NormalizedTelemetryEvent): boolean {
    return (
        (event.eventName === 'codex.sse_event' && 'input_token_count' in event.attributes) ||
        event.eventName === 'codex.turn_ttft'
    );
}

function mergeReasoningEfforts(existing: string[], current: readonly string[]): string[] {
    return [...new Set([...existing, ...current])];
}

function readStoredReasoningEfforts(value: string | undefined): string[] {
    if (!value) {
        return [];
    }

    try {
        const parsed = JSON.parse(value) as unknown;
        return Array.isArray(parsed)
            ? parsed.filter((item): item is string => typeof item === 'string')
            : [];
    } catch {
        return [];
    }
}

function upsertUsageBucket(
    database: Database.Database,
    table: 'usage_buckets' | 'conversation_usage_buckets',
    identity: { conversationId?: string; bucketStart: string; model: string },
    metrics: UsageMetrics,
): void {
    const columns = identity.conversationId
        ? 'conversation_id, bucket_start, model'
        : 'bucket_start, model';
    const values = identity.conversationId
        ? [identity.conversationId, identity.bucketStart, identity.model]
        : [identity.bucketStart, identity.model];
    const conflict = identity.conversationId
        ? '(conversation_id, bucket_start, model)'
        : '(bucket_start, model)';
    const placeholders = Array.from({ length: values.length + 8 }, () => '?').join(', ');

    database
        .prepare(
            `INSERT INTO ${table} (
                ${columns},
                input_tokens,
                cached_input_tokens,
                output_tokens,
                reasoning_tokens,
                tool_tokens,
                completed_responses,
                ttft_total_ms,
                ttft_count
            ) VALUES (${placeholders})
            ON CONFLICT ${conflict} DO UPDATE SET
                input_tokens = ${table}.input_tokens + excluded.input_tokens,
                cached_input_tokens = ${table}.cached_input_tokens + excluded.cached_input_tokens,
                output_tokens = ${table}.output_tokens + excluded.output_tokens,
                reasoning_tokens = ${table}.reasoning_tokens + excluded.reasoning_tokens,
                tool_tokens = ${table}.tool_tokens + excluded.tool_tokens,
                completed_responses = ${table}.completed_responses + excluded.completed_responses,
                ttft_total_ms = ${table}.ttft_total_ms + excluded.ttft_total_ms,
                ttft_count = ${table}.ttft_count + excluded.ttft_count`,
        )
        .run(
            ...values,
            metrics.inputTokens,
            metrics.cachedInputTokens,
            metrics.outputTokens,
            metrics.reasoningTokens,
            metrics.toolTokens,
            metrics.completedResponses,
            metrics.ttftTotalMs,
            metrics.ttftCount,
        );
}

function removeInternalConversationProjection(
    database: Database.Database,
    conversationId: string,
): void {
    database
        .prepare('DELETE FROM conversation_usage_buckets WHERE conversation_id = ?')
        .run(conversationId);
    database
        .prepare('DELETE FROM conversation_prompts WHERE conversation_id = ?')
        .run(conversationId);
    database
        .prepare('DELETE FROM conversation_summaries WHERE conversation_id = ?')
        .run(conversationId);
}

export function projectTelemetryBatch(
    database: Database.Database,
    batch: OtlpBatch,
    knownInternalConversationIds: ReadonlySet<string>,
): void {
    const newlyDetectedInternalIds = new Set(
        batch.events
            .filter((event) => {
                const prompt =
                    event.eventName === 'codex.user_prompt'
                        ? readTelemetryString(event.attributes, 'prompt')
                        : null;
                return (
                    event.conversationId !== null &&
                    prompt !== null &&
                    isTitleGenerationPrompt(prompt)
                );
            })
            .map((event) => event.conversationId as string),
    );
    const internalConversationIds = new Set([
        ...knownInternalConversationIds,
        ...newlyDetectedInternalIds,
    ]);
    const detectedAt = new Date().toISOString();

    for (const conversationId of newlyDetectedInternalIds) {
        database
            .prepare(
                `INSERT OR IGNORE INTO telemetry_internal_conversations
                    (conversation_id, detected_at)
                 VALUES (?, ?)`,
            )
            .run(conversationId, detectedAt);
        removeInternalConversationProjection(database, conversationId);
    }

    const fallbackTimestamp = new Date(batch.receivedAt).getTime();
    const usageBuckets = new Map<
        string,
        { bucketStart: string; model: string; metrics: UsageMetrics }
    >();
    const conversationUsageBuckets = new Map<
        string,
        { conversationId: string; bucketStart: string; model: string; metrics: UsageMetrics }
    >();
    const conversations = new Map<string, ConversationState>();

    for (const event of batch.events) {
        const conversationId = event.conversationId;
        if (conversationId && internalConversationIds.has(conversationId)) {
            continue;
        }

        const timestamp = getEventTimestamp(event, fallbackTimestamp);
        if (conversationId) {
            const conversation =
                conversations.get(conversationId) ?? createConversationState(timestamp);
            conversation.startedAt = Math.min(conversation.startedAt, timestamp);
            conversation.lastActivityAt = Math.max(conversation.lastActivityAt, timestamp);
            conversation.model ??= event.model;

            for (const key of ['model_reasoning_effort', 'reasoning_effort']) {
                const reasoningEffort = readTelemetryString(event.attributes, key);
                if (reasoningEffort && !conversation.reasoningEfforts.includes(reasoningEffort)) {
                    conversation.reasoningEfforts.push(reasoningEffort);
                }
            }

            if (event.eventName === 'codex.user_prompt') {
                const prompt = readUserPrompt(event.attributes);
                if (prompt) {
                    conversation.prompts.push({
                        observedAt: timestamp,
                        model: event.model,
                        text: prompt,
                    });
                }
            }

            conversations.set(conversationId, conversation);
        }

        if (!hasMetrics(event)) {
            continue;
        }

        const bucketStart = getBucketStart(timestamp);
        const model = getModelKey(event.model);
        const usageKey = `${bucketStart}\u0000${model}`;
        const usageBucket = usageBuckets.get(usageKey) ?? {
            bucketStart,
            model,
            metrics: createMetrics(),
        };
        addEventMetrics(usageBucket.metrics, event);
        usageBuckets.set(usageKey, usageBucket);

        if (conversationId) {
            const conversationKey = `${conversationId}\u0000${usageKey}`;
            const conversationBucket = conversationUsageBuckets.get(conversationKey) ?? {
                conversationId,
                bucketStart,
                model,
                metrics: createMetrics(),
            };
            addEventMetrics(conversationBucket.metrics, event);
            conversationUsageBuckets.set(conversationKey, conversationBucket);
        }
    }

    for (const bucket of usageBuckets.values()) {
        upsertUsageBucket(database, 'usage_buckets', bucket, bucket.metrics);
    }

    for (const bucket of conversationUsageBuckets.values()) {
        upsertUsageBucket(database, 'conversation_usage_buckets', bucket, bucket.metrics);
    }

    const existingSummaryStatement = database.prepare(
        `SELECT
            started_at AS startedAt,
            last_activity_at AS lastActivityAt,
            model,
            reasoning_efforts_json AS reasoningEfforts
         FROM conversation_summaries
         WHERE conversation_id = ?`,
    );
    const upsertSummaryStatement = database.prepare(
        `INSERT INTO conversation_summaries (
            conversation_id,
            started_at,
            last_activity_at,
            model,
            initial_prompt,
            reasoning_efforts_json
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(conversation_id) DO UPDATE SET
            started_at = excluded.started_at,
            last_activity_at = excluded.last_activity_at,
            model = excluded.model,
            initial_prompt = excluded.initial_prompt,
            reasoning_efforts_json = excluded.reasoning_efforts_json`,
    );
    const insertPromptStatement = database.prepare(
        `INSERT OR IGNORE INTO conversation_prompts (
            conversation_id,
            observed_at,
            model,
            text,
            character_count
        ) VALUES (?, ?, ?, ?, ?)`,
    );
    const firstPromptStatement = database.prepare(
        `SELECT text
         FROM conversation_prompts
         WHERE conversation_id = ?
         ORDER BY observed_at ASC, id ASC
         LIMIT 1`,
    );

    for (const [conversationId, conversation] of conversations) {
        const existing = existingSummaryStatement.get(conversationId) as
            | {
                  startedAt: string;
                  lastActivityAt: string;
                  model: string | null;
                  reasoningEfforts: string;
              }
            | undefined;
        const startedAt = new Date(
            Math.min(
                new Date(
                    existing?.startedAt ?? new Date(conversation.startedAt).toISOString(),
                ).getTime(),
                conversation.startedAt,
            ),
        ).toISOString();
        const lastActivityAt = new Date(
            Math.max(
                new Date(
                    existing?.lastActivityAt ?? new Date(conversation.lastActivityAt).toISOString(),
                ).getTime(),
                conversation.lastActivityAt,
            ),
        ).toISOString();
        const model = existing?.model ?? conversation.model;

        for (const prompt of conversation.prompts) {
            insertPromptStatement.run(
                conversationId,
                new Date(prompt.observedAt).toISOString(),
                prompt.model,
                prompt.text,
                prompt.text.length,
            );
        }

        const firstPrompt = firstPromptStatement.get(conversationId) as
            { text: string } | undefined;
        upsertSummaryStatement.run(
            conversationId,
            startedAt,
            lastActivityAt,
            model,
            firstPrompt?.text ?? null,
            JSON.stringify(
                mergeReasoningEfforts(
                    readStoredReasoningEfforts(existing?.reasoningEfforts),
                    conversation.reasoningEfforts,
                ),
            ),
        );
    }
}
