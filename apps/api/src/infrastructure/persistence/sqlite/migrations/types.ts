import type Database from 'better-sqlite3';

export type SqliteMigration = {
    version: string;
    name: string;
    up: (database: Database.Database) => void;
};
