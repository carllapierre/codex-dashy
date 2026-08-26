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

describe('health route', () => {
    it('reports API and SQLite health through Fastify injection', async () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-dashy-test-'));
        temporaryDirectories.push(directory);
        const database = new SqliteDatabase(path.join(directory, 'test.db'));
        const app = await createApp({
            database,
            config: {
                host: '127.0.0.1',
                port: 0,
                databaseFile: path.join(directory, 'test.db'),
                corsOrigin: 'http://localhost:5173',
                webDistDirectory: path.join(directory, 'missing-web-dist'),
            },
        });

        const response = await app.inject({ method: 'GET', url: '/api/health' });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            status: 'ok',
            service: 'codex-dashy-api',
            database: 'ok',
            databaseIntegrity: 'ok',
        });

        await app.close();
    });

    it('accepts an OTLP log batch and persists it once', async () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-dashy-otel-test-'));
        temporaryDirectories.push(directory);
        const database = new SqliteDatabase(path.join(directory, 'test.db'));
        const app = await createApp({
            database,
            config: {
                host: '127.0.0.1',
                port: 0,
                databaseFile: path.join(directory, 'test.db'),
                corsOrigin: 'http://localhost:5173',
                webDistDirectory: path.join(directory, 'missing-web-dist'),
            },
        });
        const payload = {
            resourceLogs: [
                {
                    scopeLogs: [
                        {
                            logRecords: [
                                {
                                    attributes: [
                                        {
                                            key: 'event.name',
                                            value: { stringValue: 'codex.user_prompt' },
                                        },
                                        {
                                            key: 'conversation.id',
                                            value: { stringValue: 'conversation-1' },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        };

        const firstResponse = await app.inject({
            method: 'POST',
            url: '/v1/logs',
            payload,
        });
        const duplicateResponse = await app.inject({
            method: 'POST',
            url: '/v1/logs',
            payload,
        });

        expect(firstResponse.statusCode).toBe(200);
        expect(duplicateResponse.statusCode).toBe(200);
        expect(database.getOtelBatchCount()).toBe(1);

        await app.close();
    });
});
