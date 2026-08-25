import type Database from 'better-sqlite3';

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

    database
        .prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)')
        .run('0001_initial', new Date().toISOString());
}
