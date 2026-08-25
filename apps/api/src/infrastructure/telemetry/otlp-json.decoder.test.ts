import { describe, expect, it } from 'vitest';
import { otlpJsonDecoder } from './otlp-json.decoder';

describe('otlpJsonDecoder', () => {
    it('unwraps the captured payload shape and extracts session metadata', () => {
        const batch = otlpJsonDecoder.decode(
            {
                payload: JSON.stringify({
                    resourceLogs: [
                        {
                            resource: {
                                attributes: [
                                    {
                                        key: 'project.path',
                                        value: { stringValue: '/workspace/example' },
                                    },
                                ],
                            },
                            scopeLogs: [
                                {
                                    logRecords: [
                                        {
                                            attributes: [
                                                {
                                                    key: 'event.name',
                                                    value: {
                                                        stringValue: 'codex.conversation_starts',
                                                    },
                                                },
                                                {
                                                    key: 'conversation.id',
                                                    value: { stringValue: 'conversation-1' },
                                                },
                                                {
                                                    key: 'model',
                                                    value: { stringValue: 'gpt-5.6-luna' },
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                }),
            },
            new Date('2026-08-25T00:00:00.000Z'),
        );

        expect(batch.eventCount).toBe(1);
        expect(batch.eventNames).toEqual(['codex.conversation_starts']);
        expect(batch.conversationIds).toEqual(['conversation-1']);
        expect(batch.models).toEqual(['gpt-5.6-luna']);
        expect(batch.projectCandidates).toEqual(['/workspace/example']);
    });

    it('deduplicates equivalent payloads and redacts credential-like fields', () => {
        const payload = {
            resourceLogs: [],
            authorization: 'secret-value',
        };

        const first = otlpJsonDecoder.decode(payload, new Date('2026-08-25T00:00:00.000Z'));
        const second = otlpJsonDecoder.decode(payload, new Date('2026-08-25T01:00:00.000Z'));

        expect(first.dedupeKey).toBe(second.dedupeKey);
        expect(first.sanitizedPayload).toEqual({
            resourceLogs: [],
            authorization: '[REDACTED]',
        });
    });

    it('redacts sensitive event attributes while preserving the captured prompt', () => {
        const batch = otlpJsonDecoder.decode(
            {
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
                                                key: 'prompt',
                                                value: { stringValue: 'Inspect this project' },
                                            },
                                            {
                                                key: 'user.email',
                                                value: { stringValue: 'user@example.com' },
                                            },
                                            {
                                                key: 'user.account_id',
                                                value: { stringValue: 'account-123' },
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            new Date('2026-08-25T00:00:00.000Z'),
        );

        expect(batch.events[0]?.attributes).toMatchObject({
            prompt: 'Inspect this project',
            'user.email': '[REDACTED]',
            'user.account_id': '[REDACTED]',
        });
    });
});
