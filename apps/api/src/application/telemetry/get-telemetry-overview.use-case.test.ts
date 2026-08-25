import { describe, expect, it } from 'vitest';
import type { OtlpBatch } from '../../domain/telemetry/otel-batch';
import { GetTelemetryOverviewUseCase } from './get-telemetry-overview.use-case';

function createBatch(): OtlpBatch {
    return {
        dedupeKey: 'batch-1',
        receivedAt: '2026-08-25T12:00:00.000Z',
        eventCount: 5,
        eventNames: ['codex.user_prompt', 'codex.sse_event', 'codex.turn_ttft'],
        conversationIds: ['conversation-1', 'conversation-2'],
        models: ['gpt-5.6-luna', 'gpt-5.6-terra'],
        projectCandidates: [],
        sanitizedPayload: {},
        events: [
            {
                eventName: 'codex.user_prompt',
                observedAt: '2026-08-25T11:00:00.000Z',
                conversationId: 'conversation-1',
                model: 'gpt-5.6-luna',
                attributes: {
                    prompt: 'Inspect usage',
                    'event.name': 'codex.user_prompt',
                },
            },
            {
                eventName: 'codex.sse_event',
                observedAt: '2026-08-25T11:01:00.000Z',
                conversationId: 'conversation-1',
                model: 'gpt-5.6-luna',
                attributes: {
                    'event.kind': 'response.completed',
                    input_token_count: '1000',
                    cached_token_count: 100,
                    output_token_count: 20,
                    reasoning_token_count: 3,
                    tool_token_count: 1_020,
                },
            },
            {
                eventName: 'codex.turn_ttft',
                observedAt: '2026-08-25T11:01:01.000Z',
                conversationId: 'conversation-1',
                model: 'gpt-5.6-luna',
                attributes: { duration_ms: 500 },
            },
            {
                eventName: 'codex.user_prompt',
                observedAt: '2026-08-25T10:00:00.000Z',
                conversationId: 'conversation-2',
                model: 'gpt-5.6-terra',
                attributes: { prompt: 'Older prompt' },
            },
            {
                eventName: 'codex.sse_event',
                observedAt: '2026-08-23T11:00:00.000Z',
                conversationId: 'conversation-2',
                model: 'gpt-5.6-terra',
                attributes: {
                    input_token_count: 10_000,
                    cached_token_count: 1_000,
                    output_token_count: 100,
                },
            },
            {
                eventName: 'codex.user_prompt',
                observedAt: '2026-08-25T11:30:00.000Z',
                conversationId: 'title-generation-1',
                model: 'gpt-5.6-luna',
                attributes: {
                    prompt: 'Generate a concise UI title. User prompt: Inspect usage',
                },
            },
            {
                eventName: 'codex.sse_event',
                observedAt: '2026-08-25T11:31:00.000Z',
                conversationId: 'title-generation-1',
                model: 'gpt-5.6-luna',
                attributes: {
                    input_token_count: 5_000,
                    cached_token_count: 500,
                    output_token_count: 50,
                },
            },
            {
                eventName: 'codex.user_prompt',
                observedAt: '2026-08-25T03:30:00.000Z',
                conversationId: 'previous-local-day',
                model: 'gpt-5.6-terra',
                attributes: { prompt: 'Late yesterday' },
            },
            {
                eventName: 'codex.sse_event',
                observedAt: '2026-08-25T03:31:00.000Z',
                conversationId: 'previous-local-day',
                model: 'gpt-5.6-terra',
                attributes: {
                    input_token_count: 5_000,
                    output_token_count: 50,
                },
            },
        ],
    };
}

describe('GetTelemetryOverviewUseCase', () => {
    it('filters by time and model, aggregates conversations, and estimates cost', () => {
        const useCase = new GetTelemetryOverviewUseCase(
            { list: () => [createBatch()] },
            () => new Date('2026-08-25T12:00:00.000Z'),
        );

        const overview = useCase.execute('1d', 'gpt-5.6-luna');

        expect(overview.availableModels).toEqual(['gpt-5.6-luna', 'gpt-5.6-terra']);
        expect(overview.summary).toMatchObject({
            inputTokens: 1000,
            cachedInputTokens: 100,
            outputTokens: 20,
            reasoningTokens: 3,
            totalTokens: 1020,
            conversationCount: 1,
            completedResponses: 1,
            averageTtftMs: 500,
        });
        expect(overview.summary.estimatedCostUsd).toBeCloseTo(0.000206, 8);
        expect(overview.conversations[0]).toMatchObject({
            id: 'conversation-1',
            initialPrompt: 'Inspect usage',
            model: 'gpt-5.6-luna',
            totalTokens: 1020,
        });
        expect(overview.conversations).toHaveLength(1);
        expect(overview.trend.some((point) => point.totalTokens === 1020)).toBe(true);
    });

    it('uses the browser time zone for calendar-day filtering', () => {
        const useCase = new GetTelemetryOverviewUseCase(
            { list: () => [createBatch()] },
            () => new Date('2026-08-25T12:00:00.000Z'),
        );

        const overview = useCase.execute('1d', null, 'America/Toronto');

        expect(overview.conversations.some(({ id }) => id === 'previous-local-day')).toBe(false);
        expect(overview.summary.totalTokens).toBe(1020);
    });
});
