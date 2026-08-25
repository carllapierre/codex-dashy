import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type {
    OtlpBatch,
    OtlpBatchQueryRepository,
    OtlpBatchRepository,
} from '../../../domain/telemetry/otel-batch';
import { runMigrations } from './migrations';

export class SqliteDatabase implements OtlpBatchRepository, OtlpBatchQueryRepository {
    private readonly database: Database.Database;

    public constructor(filename: string) {
        fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
        this.database = new Database(filename);
        this.database.pragma('journal_mode = WAL');
        runMigrations(this.database);
    }

    public isHealthy(): boolean {
        const result = this.database.prepare('SELECT 1 AS ok').get() as { ok?: number } | undefined;
        return result?.ok === 1;
    }

    public save(batch: OtlpBatch): boolean {
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

        return result.changes > 0;
    }

    public getOtelBatchCount(): number {
        const result = this.database
            .prepare('SELECT COUNT(*) AS count FROM otel_batches')
            .get() as {
            count?: number;
        };

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
            .all() as Array<{
            dedupeKey: string;
            receivedAt: string;
            eventCount: number;
            eventNames: string;
            conversationIds: string;
            models: string;
            projectCandidates: string;
            events: string;
            sanitizedPayload: string;
        }>;

        return rows.map((row) => ({
            dedupeKey: row.dedupeKey,
            receivedAt: row.receivedAt,
            eventCount: row.eventCount,
            eventNames: JSON.parse(row.eventNames) as string[],
            conversationIds: JSON.parse(row.conversationIds) as string[],
            models: JSON.parse(row.models) as string[],
            projectCandidates: JSON.parse(row.projectCandidates) as string[],
            events: JSON.parse(row.events) as OtlpBatch['events'],
            sanitizedPayload: JSON.parse(row.sanitizedPayload) as unknown,
        }));
    }

    public close(): void {
        this.database.close();
    }
}
