import type { SqliteMigration } from './types';

export const initialMigration: SqliteMigration = {
    version: '0001_initial',
    name: 'initial',
    up(database) {
        database.exec(`
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
    },
};
