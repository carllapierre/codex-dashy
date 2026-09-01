import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type {
    ModelRate,
    ModelRateRepository,
    ModelRateValues,
} from '../../../domain/settings/model-rate';
import type {
    OtlpBatch,
    OtlpBatchQueryRepository,
    OtlpBatchRepository,
} from '../../../domain/telemetry/otel-batch';
import type {
    TelemetryConversationProjection,
    TelemetryProjectionQueryRepository,
    TelemetryUsageBucket,
} from '../../../domain/telemetry/telemetry-projection';
import { runMigrations } from './migration-runner';
import { SqliteTelemetryProjectionRepository } from './sqlite-telemetry-projection-repository';

const integrityCheckIntervalMs = 6 * 60 * 60 * 1_000;

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

export class SqliteDatabase
    implements
        OtlpBatchRepository,
        OtlpBatchQueryRepository,
        TelemetryProjectionQueryRepository,
        ModelRateRepository
{
    private readonly database: Database.Database;
    private readonly telemetryProjections: SqliteTelemetryProjectionRepository;
    private readonly integrityCheckTimer: NodeJS.Timeout;
    private databaseIntegrityHealthy = false;

    public constructor(filename: string) {
        fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
        this.database = new Database(filename);
        this.database.pragma('journal_mode = WAL');
        this.database.pragma('synchronous = FULL');
        this.database.pragma('busy_timeout = 5000');
        this.database.pragma('wal_autocheckpoint = 1000');
        runMigrations(this.database);
        this.telemetryProjections = new SqliteTelemetryProjectionRepository(this.database);
        this.telemetryProjections.backfill();
        this.refreshIntegrityStatus();
        this.integrityCheckTimer = setInterval(
            () => this.refreshIntegrityStatus(),
            integrityCheckIntervalMs,
        );
        this.integrityCheckTimer.unref();
    }

    public isHealthy(): boolean {
        const result = this.database.prepare('SELECT 1 AS ok').get() as { ok?: number } | undefined;
        return result?.ok === 1;
    }

    public isIntegrityHealthy(): boolean {
        return this.databaseIntegrityHealthy;
    }

    private refreshIntegrityStatus(): void {
        try {
            const results = this.database.prepare('PRAGMA integrity_check').all() as Array<{
                integrity_check?: string;
            }>;
            this.databaseIntegrityHealthy =
                results.length === 1 && results[0]?.integrity_check === 'ok';
        } catch {
            this.databaseIntegrityHealthy = false;
        }
    }

    public save(batch: OtlpBatch): boolean {
        const saveBatch = this.database.transaction((): boolean => {
            const result = this.database
                .prepare(
                    `INSERT OR IGNORE INTO otel_batches (
                        dedupe_key,
                        received_at,
                        event_count,
                        event_names_json,
                        conversation_ids_json,
                        models_json,
                        project_candidates_json,
                        events_json,
                        payload_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                )
                .run(
                    batch.dedupeKey,
                    batch.receivedAt,
                    batch.eventCount,
                    JSON.stringify(batch.eventNames),
                    JSON.stringify(batch.conversationIds),
                    JSON.stringify(batch.models),
                    JSON.stringify(batch.projectCandidates),
                    JSON.stringify(batch.events),
                    JSON.stringify(batch.sanitizedPayload),
                );

            if (result.changes === 0) {
                return false;
            }

            const row = this.database
                .prepare('SELECT id FROM otel_batches WHERE dedupe_key = ?')
                .get(batch.dedupeKey) as { id: number } | undefined;
            if (!row) {
                throw new Error('Unable to locate saved telemetry batch');
            }

            this.telemetryProjections.projectBatch(batch, row.id);
            return true;
        });

        return saveBatch();
    }

    public getOtelBatchCount(): number {
        const result = this.database
            .prepare('SELECT COUNT(*) AS count FROM otel_batches')
            .get() as { count?: number };

        return result.count ?? 0;
    }

    public list(): OtlpBatch[] {
        const rows = this.database
            .prepare(
                `SELECT
                    dedupe_key AS dedupeKey,
                    received_at AS receivedAt,
                    event_count AS eventCount,
                    event_names_json AS eventNames,
                    conversation_ids_json AS conversationIds,
                    models_json AS models,
                    project_candidates_json AS projectCandidates,
                    events_json AS events,
                    payload_json AS sanitizedPayload
                 FROM otel_batches
                 ORDER BY id ASC`,
            )
            .all() as StoredBatchRow[];

        return rows.map((row) => this.parseStoredBatch(row));
    }

    public listUsageBuckets(since: string, model: string | null): TelemetryUsageBucket[] {
        return this.telemetryProjections.listUsageBuckets(since, model);
    }

    public listConversationProjections(
        since: string,
        model: string | null,
    ): TelemetryConversationProjection[] {
        return this.telemetryProjections.listConversationProjections(since, model);
    }

    public getConversationProjection(
        conversationId: string,
    ): TelemetryConversationProjection | null {
        return this.telemetryProjections.getConversationProjection(conversationId);
    }

    public listAvailableModels(since: string): string[] {
        return this.telemetryProjections.listAvailableModels(since);
    }

    public listModelRates(): ModelRate[] {
        return this.database
            .prepare(
                `SELECT
                    model,
                    input_per_million_usd AS inputPerMillionUsd,
                    cached_input_per_million_usd AS cachedInputPerMillionUsd,
                    output_per_million_usd AS outputPerMillionUsd,
                    updated_at AS updatedAt
                 FROM model_rates
                 ORDER BY model ASC`,
            )
            .all() as ModelRate[];
    }

    public updateModelRate(model: string, values: ModelRateValues): ModelRate {
        const normalizedModel = model.trim().toLowerCase();
        const updatedAt = new Date().toISOString();

        this.database
            .prepare(
                `INSERT INTO model_rates (
                    model,
                    input_per_million_usd,
                    cached_input_per_million_usd,
                    output_per_million_usd,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(model) DO UPDATE SET
                    input_per_million_usd = excluded.input_per_million_usd,
                    cached_input_per_million_usd = excluded.cached_input_per_million_usd,
                    output_per_million_usd = excluded.output_per_million_usd,
                    updated_at = excluded.updated_at`,
            )
            .run(
                normalizedModel,
                values.inputPerMillionUsd,
                values.cachedInputPerMillionUsd,
                values.outputPerMillionUsd,
                updatedAt,
            );

        const rate = this.database
            .prepare(
                `SELECT
                    model,
                    input_per_million_usd AS inputPerMillionUsd,
                    cached_input_per_million_usd AS cachedInputPerMillionUsd,
                    output_per_million_usd AS outputPerMillionUsd,
                    updated_at AS updatedAt
                 FROM model_rates
                 WHERE model = ?`,
            )
            .get(normalizedModel) as ModelRate | undefined;

        if (!rate) {
            throw new Error(`Unable to read updated model rate for ${normalizedModel}`);
        }

        return rate;
    }

    public close(): void {
        clearInterval(this.integrityCheckTimer);
        this.database.close();
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
}
