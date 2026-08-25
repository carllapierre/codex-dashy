import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { OtlpBatch, OtlpBatchRepository } from '../../../domain/telemetry/otel-batch';
import { runMigrations } from './migrations';

export class SqliteDatabase implements OtlpBatchRepository {
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

    public close(): void {
        this.database.close();
    }
}
