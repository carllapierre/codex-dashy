import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL_RATES } from '../../infrastructure/telemetry/model-rate-defaults';
import type {
    TelemetryConversationProjection,
    TelemetryProjectionQueryRepository,
    TelemetryUsageBucket,
} from '../../domain/telemetry/telemetry-projection';
import { GetTelemetryOverviewUseCase } from './get-telemetry-overview.use-case';

const modelRates = {
    listModelRates: () =>
        Object.entries(DEFAULT_MODEL_RATES).map(([model, rate]) => ({
            model,
            ...rate,
            updatedAt: '2026-08-25T12:00:00.000Z',
        })),
};

const usageBuckets: TelemetryUsageBucket[] = [
    {
        startAt: '2026-08-25T11:00:00.000Z',
        model: 'gpt-5.6-luna',
        inputTokens: 1_000,
        cachedInputTokens: 100,
        outputTokens: 20,
        reasoningTokens: 3,
        toolTokens: 1_020,
        completedResponses: 1,
        ttftTotalMs: 500,
        ttftCount: 1,
    },
    {
        startAt: '2026-08-25T03:00:00.000Z',
        model: 'gpt-5.6-terra',
        inputTokens: 5_000,
        cachedInputTokens: 0,
        outputTokens: 50,
        reasoningTokens: 0,
        toolTokens: 0,
        completedResponses: 1,
        ttftTotalMs: 0,
        ttftCount: 0,
    },
];

function createProjection(
    id: string,
    model: string,
    startedAt: string,
    lastActivityAt: string,
    conversationUsage: TelemetryUsageBucket[],
    prompts: TelemetryConversationProjection['prompts'],
): TelemetryConversationProjection {
    const inputTokens = conversationUsage.reduce((total, bucket) => total + bucket.inputTokens, 0);
    const cachedInputTokens = conversationUsage.reduce(
        (total, bucket) => total + bucket.cachedInputTokens,
        0,
    );
    const outputTokens = conversationUsage.reduce(
        (total, bucket) => total + bucket.outputTokens,
        0,
    );
    const reasoningTokens = conversationUsage.reduce(
        (total, bucket) => total + bucket.reasoningTokens,
        0,
    );
    const toolTokens = conversationUsage.reduce((total, bucket) => total + bucket.toolTokens, 0);

    return {
        id,
        initialPrompt: prompts[0]?.text ?? null,
        prompts,
        startedAt,
        lastActivityAt,
        model,
        reasoningEfforts: ['high'],
        usageBuckets: conversationUsage,
        inputTokens,
        cachedInputTokens,
        outputTokens,
        reasoningTokens,
        toolTokens,
        completedResponses: conversationUsage.reduce(
            (total, bucket) => total + bucket.completedResponses,
            0,
        ),
        ttftTotalMs: conversationUsage.reduce((total, bucket) => total + bucket.ttftTotalMs, 0),
        ttftCount: conversationUsage.reduce((total, bucket) => total + bucket.ttftCount, 0),
    };
}

const conversationOneUsage = [usageBuckets[0]!];
const projections: TelemetryConversationProjection[] = [
    createProjection(
        'conversation-1',
        'gpt-5.6-luna',
        '2026-08-25T11:00:00.000Z',
        '2026-08-25T11:01:30.000Z',
        conversationOneUsage,
        [
            {
                id: 'conversation-1-prompt-1',
                text: 'Inspect usage',
                timestamp: '2026-08-25T11:00:00.000Z',
                model: 'gpt-5.6-luna',
                characterCount: 13,
            },
            {
                id: 'conversation-1-prompt-2',
                text: 'Show the follow-up usage',
                timestamp: '2026-08-25T11:01:30.000Z',
                model: 'gpt-5.6-luna',
                characterCount: 24,
            },
        ],
    ),
    createProjection(
        'previous-local-day',
        'gpt-5.6-terra',
        '2026-08-25T03:30:00.000Z',
        '2026-08-25T03:31:00.000Z',
        [usageBuckets[1]!],
        [],
    ),
];

function createRepository(
    extraBuckets: TelemetryUsageBucket[] = [],
    extraProjections: TelemetryConversationProjection[] = [],
): TelemetryProjectionQueryRepository {
    const allBuckets = [...usageBuckets, ...extraBuckets];
    const allProjections = [...projections, ...extraProjections];

    return {
        listUsageBuckets: (since, model) =>
            allBuckets.filter(
                (bucket) => bucket.startAt >= since && (model === null || bucket.model === model),
            ),
        listConversationProjections: (since, model) =>
            allProjections
                .filter(
                    (projection) =>
                        projection.lastActivityAt >= since &&
                        (model === null ||
                            projection.model === model ||
                            projection.usageBuckets.some((bucket) => bucket.model === model)),
                )
                .map((projection) => ({
                    ...projection,
                    usageBuckets: projection.usageBuckets.filter(
                        (bucket) =>
                            bucket.startAt >= since && (model === null || bucket.model === model),
                    ),
                })),
        getConversationProjection: (id) =>
            allProjections.find((projection) => projection.id === id) ?? null,
        listAvailableModels: () => ['gpt-5.6-luna', 'gpt-5.6-terra'],
    };
}

describe('GetTelemetryOverviewUseCase', () => {
    it('filters by time and model, aggregates conversations, and estimates cost', () => {
        const useCase = new GetTelemetryOverviewUseCase(
            createRepository(),
            modelRates,
            () => new Date('2026-08-25T12:00:00.000Z'),
        );

        const overview = useCase.execute('1d', 'gpt-5.6-luna');

        expect(overview.availableModels).toEqual(['gpt-5.6-luna', 'gpt-5.6-terra']);
        expect(overview.summary).toMatchObject({
            inputTokens: 1_000,
            cachedInputTokens: 100,
            outputTokens: 20,
            reasoningTokens: 3,
            totalTokens: 1_020,
            conversationCount: 1,
            completedResponses: 1,
            averageTtftMs: 500,
        });
        expect(overview.summary.estimatedCostUsd).toBeCloseTo(0.000206, 8);
        expect(overview.conversations[0]).toMatchObject({
            id: 'conversation-1',
            initialPrompt: 'Inspect usage',
            prompts: [
                {
                    id: 'conversation-1-prompt-1',
                    text: 'Inspect usage',
                    timestamp: '2026-08-25T11:00:00.000Z',
                    model: 'gpt-5.6-luna',
                    characterCount: 13,
                },
                {
                    id: 'conversation-1-prompt-2',
                    text: 'Show the follow-up usage',
                    timestamp: '2026-08-25T11:01:30.000Z',
                    model: 'gpt-5.6-luna',
                    characterCount: 24,
                },
            ],
            model: 'gpt-5.6-luna',
            reasoningEfforts: ['high'],
            totalTokens: 1_020,
        });
        expect(overview.conversations).toHaveLength(1);
        expect(overview.trend.some((point) => point.totalTokens === 1_020)).toBe(true);
    });

    it('uses the browser time zone for calendar-day filtering', () => {
        const useCase = new GetTelemetryOverviewUseCase(
            createRepository(),
            modelRates,
            () => new Date('2026-08-25T12:00:00.000Z'),
        );

        const overview = useCase.execute('1d', null, 'America/Toronto');

        expect(overview.conversations.some(({ id }) => id === 'previous-local-day')).toBe(false);
        expect(overview.summary.totalTokens).toBe(1_020);
    });

    it('uses the persisted rate values when estimating cost', () => {
        const editedRates = {
            listModelRates: () =>
                modelRates.listModelRates().map((rate) =>
                    rate.model === 'gpt-5.6-luna'
                        ? {
                              ...rate,
                              inputPerMillionUsd: 0.3,
                              cachedInputPerMillionUsd: 0.03,
                              outputPerMillionUsd: 1.5,
                          }
                        : rate,
                ),
        };
        const useCase = new GetTelemetryOverviewUseCase(
            createRepository(),
            editedRates,
            () => new Date('2026-08-25T12:00:00.000Z'),
        );

        const overview = useCase.execute('1d', 'gpt-5.6-luna');

        expect(overview.summary.estimatedCostUsd).toBeCloseTo(0.000303, 8);
    });

    it('estimates cost for an added known proxy rate', () => {
        const bucket: TelemetryUsageBucket = {
            startAt: '2026-08-25T11:00:00.000Z',
            model: 'codex-auto-review',
            inputTokens: 100,
            cachedInputTokens: 0,
            outputTokens: 10,
            reasoningTokens: 0,
            toolTokens: 0,
            completedResponses: 1,
            ttftTotalMs: 0,
            ttftCount: 0,
        };
        const projection = createProjection(
            'conversation-unknown-rate',
            'codex-auto-review',
            '2026-08-25T11:45:00.000Z',
            '2026-08-25T11:45:00.000Z',
            [bucket],
            [],
        );
        const useCase = new GetTelemetryOverviewUseCase(
            createRepository([bucket], [projection]),
            modelRates,
            () => new Date('2026-08-25T12:00:00.000Z'),
        );

        const overview = useCase.execute('1d');

        expect(overview.summary.estimatedCostUsd).not.toBeNull();
        expect(overview.summary.unpricedModels).toEqual([]);
        expect(
            overview.conversations.find(({ id }) => id === 'conversation-unknown-rate'),
        ).toMatchObject({
            estimatedCostUsd: 0.000032,
            unpricedModels: [],
        });
    });
});
