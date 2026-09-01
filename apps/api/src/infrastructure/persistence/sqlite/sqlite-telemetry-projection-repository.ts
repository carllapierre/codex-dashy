import type Database from 'better-sqlite3';
import type { OtlpBatch } from '../../../domain/telemetry/otel-batch';
import type {
    TelemetryConversationProjection,
    TelemetryProjectionQueryRepository,
    TelemetryUsageBucket,
} from '../../../domain/telemetry/telemetry-projection';
import { projectTelemetryBatch } from './telemetry-projection-writer';

type StoredBatchRow = {
    dedupeKey: string;
    receivedAt: string;
    eventCount: number;
    eventNames: string;
    conversationIds: string;
    models: string;
    projectCandidates: string;
    events: string;
    sanitizedPayload: string;
};

type ConversationAggregateRow = {
    id: string;
    initialPrompt: string | null;
    startedAt: string;
    lastActivityAt: string;
    model: string | null;
    reasoningEfforts: string;
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    toolTokens: number;
    completedResponses: number;
    ttftTotalMs: number;
    ttftCount: number;
};

export class SqliteTelemetryProjectionRepository implements TelemetryProjectionQueryRepository {
    public constructor(private readonly database: Database.Database) {}

    public projectBatch(batch: OtlpBatch, batchId: number): void {
        const internalConversationIds = new Set(
            (
                this.database
                    .prepare(
                        'SELECT conversation_id AS conversationId FROM telemetry_internal_conversations',
                    )
                    .all() as Array<{ conversationId: string }>
            ).map(({ conversationId }) => conversationId),
        );
        projectTelemetryBatch(this.database, batch, internalConversationIds);
        this.database
            .prepare(
                `INSERT OR IGNORE INTO telemetry_projection_batches (batch_id, projected_at)
                 VALUES (?, ?)`,
            )
            .run(batchId, new Date().toISOString());
    }

    public backfill(): void {
        const internalConversationIds = this.findInternalConversationIds();
        this.saveInternalConversationIds(internalConversationIds);

        const readPending = this.database.prepare(
            `SELECT
                batches.dedupe_key AS dedupeKey,
                batches.received_at AS receivedAt,
                batches.event_count AS eventCount,
                batches.event_names_json AS eventNames,
                batches.conversation_ids_json AS conversationIds,
                batches.models_json AS models,
                batches.project_candidates_json AS projectCandidates,
                batches.events_json AS events,
                batches.payload_json AS sanitizedPayload,
                batches.id AS id
             FROM otel_batches AS batches
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM telemetry_projection_batches AS projected
                 WHERE projected.batch_id = batches.id
             )
             ORDER BY batches.id ASC
             LIMIT ?`,
        );

        while (true) {
            const rows = readPending.all(100) as Array<StoredBatchRow & { id: number }>;
            if (rows.length === 0) {
                return;
            }

            let processedRows = 0;
            for (const row of rows) {
                try {
                    const projectRow = this.database.transaction(() => {
                        projectTelemetryBatch(
                            this.database,
                            this.parseStoredBatch(row),
                            internalConversationIds,
                        );
                        this.database
                            .prepare(
                                `INSERT OR IGNORE INTO telemetry_projection_batches
                                    (batch_id, projected_at)
                                 VALUES (?, ?)`,
                            )
                            .run(row.id, new Date().toISOString());
                    });
                    projectRow();
                    processedRows += 1;
                } catch {
                    // Leave malformed batches available for a future repair attempt.
                    break;
                }
            }

            if (processedRows < rows.length) {
                return;
            }
        }
    }

    public listUsageBuckets(since: string, model: string | null): TelemetryUsageBucket[] {
        return this.database
            .prepare(
                `SELECT
                    bucket_start AS startAt,
                    NULLIF(model, '') AS model,
                    input_tokens AS inputTokens,
                    cached_input_tokens AS cachedInputTokens,
                    output_tokens AS outputTokens,
                    reasoning_tokens AS reasoningTokens,
                    tool_tokens AS toolTokens,
                    completed_responses AS completedResponses,
                    ttft_total_ms AS ttftTotalMs,
                    ttft_count AS ttftCount
                 FROM usage_buckets
                 WHERE bucket_start >= ?
                   AND (? IS NULL OR NULLIF(model, '') = ?)
                 ORDER BY bucket_start ASC, model ASC`,
            )
            .all(since, model, model) as TelemetryUsageBucket[];
    }

    public listConversationProjections(
        since: string,
        model: string | null,
    ): TelemetryConversationProjection[] {
        const rows = this.database
            .prepare(
                `SELECT
                    summary.conversation_id AS id,
                    summary.initial_prompt AS initialPrompt,
                    summary.started_at AS startedAt,
                    summary.last_activity_at AS lastActivityAt,
                    summary.model AS model,
                    summary.reasoning_efforts_json AS reasoningEfforts,
                    COALESCE(SUM(usage.input_tokens), 0) AS inputTokens,
                    COALESCE(SUM(usage.cached_input_tokens), 0) AS cachedInputTokens,
                    COALESCE(SUM(usage.output_tokens), 0) AS outputTokens,
                    COALESCE(SUM(usage.reasoning_tokens), 0) AS reasoningTokens,
                    COALESCE(SUM(usage.tool_tokens), 0) AS toolTokens,
                    COALESCE(SUM(usage.completed_responses), 0) AS completedResponses,
                    COALESCE(SUM(usage.ttft_total_ms), 0) AS ttftTotalMs,
                    COALESCE(SUM(usage.ttft_count), 0) AS ttftCount
                 FROM conversation_summaries AS summary
                 LEFT JOIN conversation_usage_buckets AS usage
                    ON usage.conversation_id = summary.conversation_id
                   AND usage.bucket_start >= ?
                   AND (? IS NULL OR NULLIF(usage.model, '') = ?)
                 WHERE NOT EXISTS (
                     SELECT 1
                     FROM telemetry_internal_conversations AS internal
                     WHERE internal.conversation_id = summary.conversation_id
                 )
                   AND summary.last_activity_at >= ?
                   AND (
                       ? IS NULL
                       OR EXISTS (
                           SELECT 1
                           FROM conversation_usage_buckets AS filtered_usage
                           WHERE filtered_usage.conversation_id = summary.conversation_id
                             AND filtered_usage.bucket_start >= ?
                             AND NULLIF(filtered_usage.model, '') = ?
                       )
                       OR EXISTS (
                           SELECT 1
                           FROM conversation_prompts AS filtered_prompt
                           WHERE filtered_prompt.conversation_id = summary.conversation_id
                             AND filtered_prompt.observed_at >= ?
                             AND filtered_prompt.model = ?
                       )
                   )
                 GROUP BY summary.conversation_id
                 ORDER BY summary.last_activity_at DESC`,
            )
            .all(
                since,
                model,
                model,
                since,
                model,
                since,
                model,
                since,
                model,
            ) as ConversationAggregateRow[];
        const usageBuckets = this.listConversationUsageBuckets(
            rows.map(({ id }) => id),
            since,
            model,
        );

        return rows.map((row) => ({
            ...row,
            prompts: [],
            reasoningEfforts: this.parseReasoningEfforts(row.reasoningEfforts),
            usageBuckets: usageBuckets.get(row.id) ?? [],
        }));
    }

    public getConversationProjection(
        conversationId: string,
    ): TelemetryConversationProjection | null {
        const row = this.database
            .prepare(
                `SELECT
                    summary.conversation_id AS id,
                    summary.initial_prompt AS initialPrompt,
                    summary.started_at AS startedAt,
                    summary.last_activity_at AS lastActivityAt,
                    summary.model AS model,
                    summary.reasoning_efforts_json AS reasoningEfforts,
                    COALESCE(SUM(usage.input_tokens), 0) AS inputTokens,
                    COALESCE(SUM(usage.cached_input_tokens), 0) AS cachedInputTokens,
                    COALESCE(SUM(usage.output_tokens), 0) AS outputTokens,
                    COALESCE(SUM(usage.reasoning_tokens), 0) AS reasoningTokens,
                    COALESCE(SUM(usage.tool_tokens), 0) AS toolTokens,
                    COALESCE(SUM(usage.completed_responses), 0) AS completedResponses,
                    COALESCE(SUM(usage.ttft_total_ms), 0) AS ttftTotalMs,
                    COALESCE(SUM(usage.ttft_count), 0) AS ttftCount
                 FROM conversation_summaries AS summary
                 LEFT JOIN conversation_usage_buckets AS usage
                    ON usage.conversation_id = summary.conversation_id
                 WHERE summary.conversation_id = ?
                   AND NOT EXISTS (
                       SELECT 1
                       FROM telemetry_internal_conversations AS internal
                       WHERE internal.conversation_id = summary.conversation_id
                   )
                 GROUP BY summary.conversation_id`,
            )
            .get(conversationId) as ConversationAggregateRow | undefined;
        if (!row) {
            return null;
        }

        const prompts = this.database
            .prepare(
                `SELECT
                    id,
                    text,
                    observed_at AS timestamp,
                    model,
                    character_count AS characterCount
                 FROM conversation_prompts
                 WHERE conversation_id = ?
                 ORDER BY observed_at ASC, id ASC`,
            )
            .all(conversationId) as Array<{
            id: number;
            text: string;
            timestamp: string;
            model: string | null;
            characterCount: number;
        }>;
        const usageBuckets = this.listConversationUsageBuckets([conversationId], null, null);

        return {
            ...row,
            prompts: prompts.map((prompt, index) => ({
                ...prompt,
                id: `${conversationId}-prompt-${index + 1}`,
            })),
            reasoningEfforts: this.parseReasoningEfforts(row.reasoningEfforts),
            usageBuckets: usageBuckets.get(conversationId) ?? [],
        };
    }

    public listAvailableModels(since: string): string[] {
        const rows = this.database
            .prepare(
                `SELECT model
                 FROM usage_buckets
                 WHERE bucket_start >= ? AND model <> ''
                 UNION
                 SELECT usage.model
                 FROM conversation_usage_buckets AS usage
                 WHERE usage.bucket_start >= ?
                   AND usage.model <> ''
                   AND NOT EXISTS (
                       SELECT 1
                       FROM telemetry_internal_conversations AS internal
                       WHERE internal.conversation_id = usage.conversation_id
                   )
                 ORDER BY model ASC`,
            )
            .all(since, since) as Array<{ model: string }>;

        return rows.map(({ model }) => model);
    }

    private listConversationUsageBuckets(
        conversationIds: string[],
        since: string | null,
        model: string | null,
    ): Map<string, TelemetryUsageBucket[]> {
        const bucketsByConversation = new Map<string, TelemetryUsageBucket[]>();
        if (conversationIds.length === 0) {
            return bucketsByConversation;
        }

        const placeholders = conversationIds.map(() => '?').join(', ');
        const rows = this.database
            .prepare(
                `SELECT
                    conversation_id AS conversationId,
                    bucket_start AS startAt,
                    NULLIF(model, '') AS model,
                    input_tokens AS inputTokens,
                    cached_input_tokens AS cachedInputTokens,
                    output_tokens AS outputTokens,
                    reasoning_tokens AS reasoningTokens,
                    tool_tokens AS toolTokens,
                    completed_responses AS completedResponses,
                    ttft_total_ms AS ttftTotalMs,
                    ttft_count AS ttftCount
                 FROM conversation_usage_buckets
                 WHERE conversation_id IN (${placeholders})
                   AND (? IS NULL OR bucket_start >= ?)
                   AND (? IS NULL OR NULLIF(model, '') = ?)
                 ORDER BY bucket_start ASC, model ASC`,
            )
            .all(...conversationIds, since, since, model, model) as Array<
            TelemetryUsageBucket & { conversationId: string }
        >;

        for (const row of rows) {
            const list = bucketsByConversation.get(row.conversationId) ?? [];
            const { conversationId, ...bucket } = row;
            list.push(bucket);
            bucketsByConversation.set(conversationId, list);
        }

        return bucketsByConversation;
    }

    private findInternalConversationIds(): Set<string> {
        const internalConversationIds = new Set<string>();
        const rows = this.database
            .prepare('SELECT events_json AS events FROM otel_batches ORDER BY id ASC')
            .iterate() as Iterable<{ events: string }>;

        for (const row of rows) {
            try {
                const events = JSON.parse(row.events) as OtlpBatch['events'];
                for (const event of events) {
                    const prompt =
                        event.eventName === 'codex.user_prompt' ? event.attributes.prompt : null;
                    if (
                        event.conversationId &&
                        typeof prompt === 'string' &&
                        prompt.includes('Generate a concise UI title') &&
                        prompt.includes('User prompt:')
                    ) {
                        internalConversationIds.add(event.conversationId);
                    }
                }
            } catch {
                // A malformed raw batch cannot contribute to the projection.
            }
        }

        return internalConversationIds;
    }

    private saveInternalConversationIds(conversationIds: ReadonlySet<string>): void {
        const insertInternal = this.database.prepare(
            `INSERT OR IGNORE INTO telemetry_internal_conversations
                (conversation_id, detected_at)
             VALUES (?, ?)`,
        );
        const detectedAt = new Date().toISOString();
        const save = this.database.transaction(() => {
            for (const conversationId of conversationIds) {
                insertInternal.run(conversationId, detectedAt);
            }
        });
        save();
    }

    private parseStoredBatch(row: StoredBatchRow): OtlpBatch {
        return {
            dedupeKey: row.dedupeKey,
            receivedAt: row.receivedAt,
            eventCount: row.eventCount,
            eventNames: JSON.parse(row.eventNames) as string[],
            conversationIds: JSON.parse(row.conversationIds) as string[],
            models: JSON.parse(row.models) as string[],
            projectCandidates: JSON.parse(row.projectCandidates) as string[],
            events: JSON.parse(row.events) as OtlpBatch['events'],
            sanitizedPayload: JSON.parse(row.sanitizedPayload) as unknown,
        };
    }

    private parseReasoningEfforts(value: string): string[] {
        try {
            const parsed = JSON.parse(value) as unknown;
            return Array.isArray(parsed)
                ? parsed.filter((item): item is string => typeof item === 'string')
                : [];
        } catch {
            return [];
        }
    }
}
