import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import type { OtlpBatch } from '../../../domain/telemetry/otel-batch';
import { migrations } from './migrations';
import { runMigrations } from './migration-runner';
import { SqliteDatabase } from './sqlite-database';

const temporaryDirectories: string[] = [];

afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

describe('SqliteDatabase model rates', () => {
    it('seeds defaults once and preserves edits across database reopen', () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-dashy-rates-'));
        temporaryDirectories.push(directory);
        const filename = path.join(directory, 'test.db');
        const database = new SqliteDatabase(filename);

        expect(database.isIntegrityHealthy()).toBe(true);
        expect(
            database.listModelRates().find(({ model }) => model === 'gpt-5.6-luna'),
        ).toMatchObject({
            inputPerMillionUsd: 0.2,
            cachedInputPerMillionUsd: 0.02,
            outputPerMillionUsd: 1.2,
        });
        expect(
            database.listModelRates().find(({ model }) => model === 'codex-auto-review'),
        ).toMatchObject({
            inputPerMillionUsd: 0.2,
            cachedInputPerMillionUsd: 0.02,
            outputPerMillionUsd: 1.2,
        });

        database.updateModelRate('gpt-5.6-luna', {
            inputPerMillionUsd: 0.3,
            cachedInputPerMillionUsd: 0.03,
            outputPerMillionUsd: 1.5,
        });
        database.close();

        const reopenedDatabase = new SqliteDatabase(filename);
        expect(
            reopenedDatabase.listModelRates().find(({ model }) => model === 'gpt-5.6-luna'),
        ).toMatchObject({
            inputPerMillionUsd: 0.3,
            cachedInputPerMillionUsd: 0.03,
            outputPerMillionUsd: 1.5,
        });
        reopenedDatabase.close();
    });
});

function createTelemetryBatch(dedupeKey = 'telemetry-batch-1'): OtlpBatch {
    return {
        dedupeKey,
        receivedAt: '2026-08-25T12:00:00.000Z',
        eventCount: 3,
        eventNames: ['codex.user_prompt', 'codex.sse_event', 'codex.turn_ttft'],
        conversationIds: ['conversation-1'],
        models: ['gpt-5.6-luna'],
        projectCandidates: [],
        sanitizedPayload: {},
        events: [
            {
                eventName: 'codex.user_prompt',
                observedAt: '2026-08-25T11:00:00.000Z',
                conversationId: 'conversation-1',
                model: 'gpt-5.6-luna',
                attributes: { prompt: 'Inspect usage' },
            },
            {
                eventName: 'codex.sse_event',
                observedAt: '2026-08-25T11:01:00.000Z',
                conversationId: 'conversation-1',
                model: 'gpt-5.6-luna',
                attributes: {
                    input_token_count: 1_000,
                    cached_token_count: 100,
                    output_token_count: 20,
                },
            },
            {
                eventName: 'codex.turn_ttft',
                observedAt: '2026-08-25T11:01:01.000Z',
                conversationId: 'conversation-1',
                model: 'gpt-5.6-luna',
                attributes: { duration_ms: 500 },
            },
        ],
    };
}

describe('SqliteDatabase telemetry projections', () => {
    it('projects accepted batches and does not double-count duplicates', () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-dashy-projection-'));
        temporaryDirectories.push(directory);
        const database = new SqliteDatabase(path.join(directory, 'test.db'));
        const batch = createTelemetryBatch();

        expect(database.save(batch)).toBe(true);
        expect(database.save(batch)).toBe(false);
        expect(database.listUsageBuckets('2026-08-25T00:00:00.000Z', null)).toMatchObject([
            {
                model: 'gpt-5.6-luna',
                inputTokens: 1_000,
                cachedInputTokens: 100,
                outputTokens: 20,
                completedResponses: 1,
                ttftTotalMs: 500,
                ttftCount: 1,
            },
        ]);
        expect(database.listConversationProjections('2026-08-25T00:00:00.000Z', null)).toHaveLength(
            1,
        );
        expect(database.getConversationProjection('conversation-1')?.prompts).toMatchObject([
            { text: 'Inspect usage', characterCount: 13 },
        ]);

        database.close();
    });

    it('backfills projections when opening a database with legacy raw batches', () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-dashy-backfill-'));
        temporaryDirectories.push(directory);
        const filename = path.join(directory, 'test.db');
        const legacyDatabase = new Database(filename);
        runMigrations(legacyDatabase, migrations.slice(0, 3));
        const batch = createTelemetryBatch('legacy-batch-1');
        legacyDatabase
            .prepare(
                `INSERT INTO otel_batches (
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
        legacyDatabase.close();

        const database = new SqliteDatabase(filename);

        expect(database.listUsageBuckets('2026-08-25T00:00:00.000Z', null)).toHaveLength(1);
        expect(database.getConversationProjection('conversation-1')?.initialPrompt).toBe(
            'Inspect usage',
        );
        database.close();
    });
});
