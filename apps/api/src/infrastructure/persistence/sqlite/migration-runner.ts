import type Database from 'better-sqlite3';
import { migrations } from './migrations';
import type { SqliteMigration } from './migrations/types';

type AppliedMigration = {
    version: string;
};

export function runMigrations(
    database: Database.Database,
    migrationList: readonly SqliteMigration[] = migrations,
): void {
    database.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL
        );
    `);

    const appliedVersions = new Set(
        (database.prepare('SELECT version FROM schema_migrations').all() as AppliedMigration[]).map(
            ({ version }) => version,
        ),
    );

    const applyMigration = database.transaction((migration: SqliteMigration): void => {
        migration.up(database);
        database
            .prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
            .run(migration.version, new Date().toISOString());
    });

    for (const migration of migrationList) {
        if (!appliedVersions.has(migration.version)) {
            applyMigration(migration);
        }
    }
}
