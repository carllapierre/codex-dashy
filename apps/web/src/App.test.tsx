import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
            startedAt: '2026-08-25T11:00:00.000Z',
            lastActivityAt: '2026-08-25T11:01:00.000Z',
            model: 'gpt-5.6-luna',
            inputTokens: 1_000,
            cachedInputTokens: 100,
            outputTokens: 20,
            reasoningTokens: 3,
            toolTokens: 1_020,
            totalTokens: 1_020,
            estimatedCostUsd: 0.000206,
            completedResponses: 1,
            averageTtftMs: 500,
        },
        {
            id: 'conversation-2',
            initialPrompt: 'Review this prompt '.repeat(24),
            startedAt: '2026-08-25T10:00:00.000Z',
            lastActivityAt: '2026-08-25T10:30:00.000Z',
            model: 'gpt-5.6-terra',
            inputTokens: 2_000,
            cachedInputTokens: 0,
            outputTokens: 30,
            reasoningTokens: 0,
            toolTokens: 2_030,
            totalTokens: 2_030,
            estimatedCostUsd: 0.00406,
            completedResponses: 1,
            averageTtftMs: 700,
        },
    ],
};

describe('App', () => {
    afterEach(() => {
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
        expect(screen.getByText('Inspect [usage totals](https://example.com/usage)')).toBeVisible();
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
        expect(screen.getByRole('button', { name: 'Show full prompt' })).toBeVisible();

        fireEvent.click(screen.getByRole('button', { name: 'Show full prompt' }));
        expect(screen.getByRole('button', { name: 'Collapse prompt' })).toBeVisible();

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
        expect(await screen.findByRole('link', { name: 'usage totals' })).toHaveAttribute(
            'href',
            'https://example.com/usage',
        );
    });
});
