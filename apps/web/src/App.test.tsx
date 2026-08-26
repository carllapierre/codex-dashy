import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import type { TelemetryOverview } from './features/telemetry/telemetry.types';

const overview: TelemetryOverview = {
    range: '7d',
    model: null,
    availableModels: ['gpt-5.6-luna', 'gpt-5.6-terra'],
    generatedAt: '2026-08-25T12:00:00.000Z',
    summary: {
        inputTokens: 1_000,
        cachedInputTokens: 100,
        outputTokens: 20,
        reasoningTokens: 3,
        toolTokens: 1_020,
        totalTokens: 1_020,
        estimatedCostUsd: 0.000206,
        unpricedModels: [],
        conversationCount: 2,
        completedResponses: 1,
        averageTtftMs: 500,
    },
    trend: [
        {
            startAt: '2026-08-25T11:00:00.000Z',
            label: 'Aug 25',
            totalTokens: 1_020,
            estimatedCostUsd: 0.000206,
        },
    ],
    conversations: [
        {
            id: 'conversation-1',
            initialPrompt: 'Inspect [usage totals](https://example.com/usage)',
            prompts: [
                {
                    id: 'conversation-1-prompt-1',
                    text: 'Inspect [usage totals](https://example.com/usage)',
                    timestamp: '2026-08-25T11:00:00.000Z',
                    model: 'gpt-5.6-luna',
                    characterCount: 49,
                },
            ],
            startedAt: '2026-08-25T11:00:00.000Z',
            lastActivityAt: '2026-08-25T11:01:00.000Z',
            model: 'gpt-5.6-luna',
            reasoningEfforts: [],
            inputTokens: 1_000,
            cachedInputTokens: 100,
            outputTokens: 20,
            reasoningTokens: 3,
            toolTokens: 1_020,
            totalTokens: 1_020,
            estimatedCostUsd: 0.000206,
            unpricedModels: [],
            completedResponses: 1,
            averageTtftMs: 500,
        },
        {
            id: 'conversation-2',
            initialPrompt: 'Review this prompt '.repeat(24),
            prompts: [
                {
                    id: 'conversation-2-prompt-1',
                    text: 'Review this prompt '.repeat(24),
                    timestamp: '2026-08-25T10:00:00.000Z',
                    model: 'gpt-5.6-terra',
                    characterCount: 'Review this prompt '.repeat(24).length,
                },
                {
                    id: 'conversation-2-prompt-2',
                    text: 'Now show the key findings from the review.',
                    timestamp: '2026-08-25T10:30:00.000Z',
                    model: 'gpt-5.6-terra',
                    characterCount: 42,
                },
            ],
            startedAt: '2026-08-25T10:00:00.000Z',
            lastActivityAt: '2026-08-25T10:30:00.000Z',
            model: 'gpt-5.6-terra',
            reasoningEfforts: [],
            inputTokens: 2_000,
            cachedInputTokens: 0,
            outputTokens: 30,
            reasoningTokens: 0,
            toolTokens: 2_030,
            totalTokens: 2_030,
            estimatedCostUsd: 0.00406,
            unpricedModels: [],
            completedResponses: 1,
            averageTtftMs: 700,
        },
    ],
};

describe('App', () => {
    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });

    it('renders real overview data and supports filtering and conversation selection', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => overview,
        });
        vi.stubGlobal('fetch', fetchMock);

        render(<App />);

        expect(await screen.findByRole('heading', { name: 'Codex usage' })).toBeVisible();
        expect(
            await screen.findByText('Inspect [usage totals](https://example.com/usage)'),
        ).toBeVisible();
        expect(screen.getByRole('option', { name: 'gpt-5.6-terra' })).toBeVisible();

        fireEvent.click(screen.getByRole('button', { name: '1 day' }));
        await waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('range=1d')),
        );

        fireEvent.click(screen.getByRole('button', { name: /Review this prompt/ }));
        expect(await screen.findByRole('heading', { name: 'gpt-5.6-terra' })).toBeVisible();
        expect(screen.queryByRole('heading', { name: 'Codex usage' })).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Conversation usage' })).toBeVisible();
        expect(screen.getByRole('region', { name: 'Conversation summary' })).toBeVisible();
        expect(screen.getByRole('region', { name: 'Conversation token breakdown' })).toBeVisible();
        expect(screen.getByRole('region', { name: 'Conversation prompts' })).toBeVisible();
        expect(screen.getByRole('button', { name: /Follow-up 1/ })).toBeVisible();

        fireEvent.click(screen.getByRole('button', { name: /Follow-up 1/ }));
        expect(
            within(screen.getByRole('region', { name: 'Follow-up 1 content' })).getByText(
                'Now show the key findings from the review.',
            ),
        ).toBeVisible();
        expect(screen.getAllByText('Now show the key findings from the review.')).toHaveLength(1);

        fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
        expect(screen.getByRole('heading', { name: 'Codex usage' })).toBeVisible();
        expect(screen.getByRole('button', { name: /Review this prompt/ })).not.toHaveClass(
            'conversation-item--active',
        );

        fireEvent.click(
            screen.getByRole('button', {
                name: /Inspect \[usage totals\]\(https:\/\/example\.com\/usage\)/,
            }),
        );
        fireEvent.click(screen.getByRole('button', { name: /Initial prompt/ }));
        expect(await screen.findByRole('link', { name: 'usage totals' })).toHaveAttribute(
            'href',
            'https://example.com/usage',
        );

        fireEvent.click(screen.getByRole('button', { name: 'Model rates' }));
        expect(screen.getByRole('heading', { name: 'Model rates', level: 1 })).toBeVisible();
        expect(screen.queryByRole('group', { name: 'Time window' })).not.toBeInTheDocument();
    });

    it('keeps usage limits visible when the telemetry overview is unavailable', async () => {
        const fetchMock = vi.fn().mockImplementation((url: string) => {
            if (url.startsWith('/api/telemetry/overview')) {
                return Promise.resolve({ ok: false, json: async () => ({}) });
            }

            return Promise.resolve({
                ok: true,
                json: async () => ({
                    available: true,
                    fetchedAt: '2026-08-25T19:00:00.000Z',
                    rateLimits: {
                        primary: { usedPercent: 4, windowDurationMins: 300 },
                        secondary: { usedPercent: 7, windowDurationMins: 10_080 },
                    },
                    rateLimitsByLimitId: null,
                    rateLimitResetCredits: null,
                    usage: null,
                    error: null,
                }),
            });
        });
        vi.stubGlobal('fetch', fetchMock);

        render(<App />);

        expect(await screen.findByText('5 hour usage limit')).toBeVisible();
        expect(screen.getByText('Weekly usage limit')).toBeVisible();
    });

    it('explains when an estimated cost is unavailable for an unpriced model', async () => {
        const overviewWithUnpricedModel: TelemetryOverview = {
            ...overview,
            summary: {
                ...overview.summary,
                estimatedCostUsd: null,
                unpricedModels: ['codex-auto-review'],
            },
        };
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => overviewWithUnpricedModel,
        });
        vi.stubGlobal('fetch', fetchMock);

        render(<App />);

        expect(
            await screen.findByText(
                'Estimated cost is unavailable because no rate is configured for codex-auto-review.',
            ),
        ).toBeVisible();
    });

    it('keeps the conversation view usable while an older API payload is still cached', async () => {
        const legacyOverview = {
            ...overview,
            conversations: overview.conversations.map((conversation) => {
                const legacyConversation = { ...conversation };
                delete (legacyConversation as { prompts?: unknown }).prompts;
                return legacyConversation;
            }),
        } as unknown as TelemetryOverview;
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => legacyOverview,
        });
        vi.stubGlobal('fetch', fetchMock);

        render(<App />);

        fireEvent.click(
            await screen.findByRole('button', {
                name: /Inspect \[usage totals\]\(https:\/\/example\.com\/usage\)/,
            }),
        );

        expect(await screen.findByRole('heading', { name: 'gpt-5.6-luna' })).toBeVisible();
        expect(screen.getByRole('button', { name: /Initial prompt/ })).toBeVisible();
    });

    it('keeps overview data visible when the usage limits bridge is unavailable', async () => {
        const fetchMock = vi.fn().mockImplementation((url: string) => {
            if (url.startsWith('/api/telemetry/overview')) {
                return Promise.resolve({ ok: true, json: async () => overview });
            }

            return Promise.resolve({ ok: false, json: async () => ({}) });
        });
        vi.stubGlobal('fetch', fetchMock);

        render(<App />);

        expect(await screen.findByRole('heading', { name: 'Codex usage' })).toBeVisible();
        expect(
            await screen.findByText('Inspect [usage totals](https://example.com/usage)'),
        ).toBeVisible();
    });
});
