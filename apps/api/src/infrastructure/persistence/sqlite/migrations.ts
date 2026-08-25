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
    `);

    database
        .prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)')
        .run('0001_initial', new Date().toISOString());
}
