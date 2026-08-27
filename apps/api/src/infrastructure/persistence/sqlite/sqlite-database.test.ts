import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
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
