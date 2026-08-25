import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { SqliteDatabase } from '../../infrastructure/persistence/sqlite/sqlite-database';

const temporaryDirectories: string[] = [];

afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

describe('model rates routes', () => {
    it('lists seeded rates and persists a valid update', async () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-dashy-rate-route-'));
        temporaryDirectories.push(directory);
        const filename = path.join(directory, 'test.db');
        const database = new SqliteDatabase(filename);
        const app = await createApp({
            database,
            config: {
                host: '127.0.0.1',
                port: 0,
                databaseFile: filename,
                corsOrigin: 'http://localhost:5173',
                webDistDirectory: path.join(directory, 'missing-web-dist'),
            },
        });

        const listResponse = await app.inject({
            method: 'GET',
            url: '/api/settings/model-rates',
        });
        const updateResponse = await app.inject({
            method: 'PUT',
            url: '/api/settings/model-rates/gpt-5.6-luna',
            payload: {
                inputPerMillionUsd: 0.3,
                cachedInputPerMillionUsd: 0.03,
                outputPerMillionUsd: 1.5,
            },
        });

        expect(listResponse.statusCode).toBe(200);
        expect(listResponse.json()).toEqual(
            expect.arrayContaining([expect.objectContaining({ model: 'gpt-5.6-luna' })]),
        );
        expect(updateResponse.statusCode).toBe(200);
        expect(updateResponse.json()).toMatchObject({
            model: 'gpt-5.6-luna',
            inputPerMillionUsd: 0.3,
        });

        await app.close();
    });

    it('rejects invalid rate values', async () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-dashy-invalid-rate-'));
        temporaryDirectories.push(directory);
        const filename = path.join(directory, 'test.db');
        const database = new SqliteDatabase(filename);
        const app = await createApp({
            database,
            config: {
                host: '127.0.0.1',
                port: 0,
                databaseFile: filename,
                corsOrigin: 'http://localhost:5173',
                webDistDirectory: path.join(directory, 'missing-web-dist'),
            },
        });

        const response = await app.inject({
            method: 'PUT',
            url: '/api/settings/model-rates/gpt-5.6-luna',
            payload: {
                inputPerMillionUsd: -1,
                cachedInputPerMillionUsd: 0.03,
                outputPerMillionUsd: 1.5,
            },
        });

        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({
            error: 'inputPerMillionUsd must be a non-negative number',
        });

        await app.close();
    });
});
