import { afterEach, describe, expect, it, vi } from 'vitest';
import { CodexUsageBridgeClient } from './codex-usage-bridge.client';

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('CodexUsageBridgeClient', () => {
    it('normalizes a live bridge snapshot', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    available: true,
                    fetchedAt: '2026-08-25T19:00:00.000Z',
                    rateLimits: {
                        primary: { usedPercent: 4, windowDurationMins: 300 },
                    },
                    rateLimitsByLimitId: null,
                    rateLimitResetCredits: null,
                    usage: null,
                    error: null,
                }),
            }),
        );

        const snapshot = await new CodexUsageBridgeClient('http://127.0.0.1:8790').getSnapshot();

        expect(snapshot).toMatchObject({
            available: true,
            fetchedAt: '2026-08-25T19:00:00.000Z',
            rateLimits: {
                primary: { usedPercent: 4 },
            },
        });
    });

    it('returns an unavailable state when the bridge cannot be reached', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connect refused')));

        const snapshot = await new CodexUsageBridgeClient('http://127.0.0.1:8790').getSnapshot();

        expect(snapshot).toEqual({
            available: false,
            fetchedAt: null,
            rateLimits: null,
            rateLimitsByLimitId: null,
            rateLimitResetCredits: null,
            usage: null,
            error: 'connect refused',
        });
    });
});
