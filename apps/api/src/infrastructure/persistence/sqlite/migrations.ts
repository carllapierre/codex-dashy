import type Database from 'better-sqlite3';
import { DEFAULT_MODEL_RATES } from '../../telemetry/model-rate-defaults';

export function runMigrations(database: Database.Database): void {
    database.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS app_metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS otel_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dedupe_key TEXT NOT NULL UNIQUE,
            received_at TEXT NOT NULL,
            event_count INTEGER NOT NULL,
            event_names_json TEXT NOT NULL,
            conversation_ids_json TEXT NOT NULL,
            models_json TEXT NOT NULL,
            project_candidates_json TEXT NOT NULL,
            events_json TEXT NOT NULL,
            payload_json TEXT NOT NULL
        );
    `);

    const hasMigration = (version: string): boolean => {
        const row = database
            .prepare('SELECT 1 AS applied FROM schema_migrations WHERE version = ?')
            .get(version) as { applied?: number } | undefined;

        return row?.applied === 1;
    };

    const markMigrationApplied = (version: string): void => {
        database
            .prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
            .run(version, new Date().toISOString());
    };

    if (!hasMigration('0001_initial')) {
        markMigrationApplied('0001_initial');
    }

    if (!hasMigration('0002_model_rates')) {
        database.exec(`
            CREATE TABLE IF NOT EXISTS model_rates (
                model TEXT PRIMARY KEY,
                input_per_million_usd REAL NOT NULL CHECK (input_per_million_usd >= 0),
                cached_input_per_million_usd REAL NOT NULL CHECK (cached_input_per_million_usd >= 0),
                output_per_million_usd REAL NOT NULL CHECK (output_per_million_usd >= 0),
                updated_at TEXT NOT NULL
            );
        `);

        const seedRate = database.prepare(`
            INSERT OR IGNORE INTO model_rates (
                model,
                input_per_million_usd,
                cached_input_per_million_usd,
                output_per_million_usd,
                updated_at
            ) VALUES (?, ?, ?, ?, ?)
        `);
        const seededAt = new Date().toISOString();

        for (const [model, rate] of Object.entries(DEFAULT_MODEL_RATES)) {
            seedRate.run(
                model,
                rate.inputPerMillionUsd,
                rate.cachedInputPerMillionUsd,
                rate.outputPerMillionUsd,
                seededAt,
            );
        }

        markMigrationApplied('0002_model_rates');
    }
}
