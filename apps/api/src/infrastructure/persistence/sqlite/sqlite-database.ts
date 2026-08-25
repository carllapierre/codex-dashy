import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { runMigrations } from './migrations';

export class SqliteDatabase {
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

    public close(): void {
        this.database.close();
    }
}
