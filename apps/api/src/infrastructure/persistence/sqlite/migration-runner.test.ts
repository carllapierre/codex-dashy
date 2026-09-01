import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { runMigrations } from './migration-runner';
import type { SqliteMigration } from './migrations/types';

describe('runMigrations', () => {
    it('applies the ordered migration registry and records each migration', () => {
        const database = new Database(':memory:');

        runMigrations(database);

        expect(
            database.prepare('SELECT version FROM schema_migrations ORDER BY rowid ASC').all(),
        ).toEqual([
            { version: '0001_initial' },
            { version: '0002_model_rates' },
            { version: '0003_codex_auto_review_rate' },
            { version: '0004_telemetry_projections' },
        ]);
        expect(
            database
                .prepare(
                    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
                )
                .all(),
        ).toEqual([
            { name: 'app_metadata' },
            { name: 'conversation_prompts' },
            { name: 'conversation_summaries' },
            { name: 'conversation_usage_buckets' },
            { name: 'model_rates' },
            { name: 'otel_batches' },
            { name: 'schema_migrations' },
            { name: 'telemetry_internal_conversations' },
            { name: 'telemetry_projection_batches' },
            { name: 'usage_buckets' },
        ]);

        database.close();
    });

    it('does not record a migration when its transaction fails', () => {
        const database = new Database(':memory:');
        const failingMigration: SqliteMigration = {
            version: '0001_failure',
            name: 'failure',
            up(currentDatabase) {
                currentDatabase.exec('CREATE TABLE transient_table (value TEXT NOT NULL)');
                throw new Error('migration failed');
            },
        };

        expect(() => runMigrations(database, [failingMigration])).toThrow('migration failed');
        expect(
            database.prepare("SELECT name FROM sqlite_master WHERE name = 'transient_table'").get(),
        ).toBeUndefined();
        expect(database.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get()).toEqual({
            count: 0,
        });

        database.close();
    });
});
