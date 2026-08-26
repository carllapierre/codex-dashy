import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from './env';

const originalDatabaseFile = process.env.DB_FILE;

afterEach(() => {
    if (originalDatabaseFile === undefined) {
        delete process.env.DB_FILE;
    } else {
        process.env.DB_FILE = originalDatabaseFile;
    }
});

describe('loadConfig', () => {
    it('resolves relative database paths from the project root', () => {
        process.env.DB_FILE = 'data/dev.db';

        expect(loadConfig().databaseFile).toBe(
            path.resolve(__dirname, '../../../../../data/dev.db'),
        );
    });
});
