import type { ModelRate, ModelRateQueryRepository } from '../../domain/settings/model-rate';
import type {
    TelemetryProjectionQueryRepository,
    TelemetryUsageBucket,
} from '../../domain/telemetry/telemetry-projection';
import {
    type TelemetryOverview,
    type TelemetryRange,
    type TelemetrySummary,
    type TelemetryTrendPoint,
} from '../../domain/telemetry/telemetry-overview';
import {
    addUsageBucket,
    createUsageTotals,
    toAverageTtft,
    toCost,
    toTelemetryConversation,
} from './telemetry-usage-mappers';

const RANGE_DAYS: Record<TelemetryRange, number> = {
    '1d': 1,
    '7d': 7,
    '30d': 30,
};

function readDateParts(date: Date, timeZone: string): { year: number; month: number; day: number } {
    const parts = new Intl.DateTimeFormat('en-CA', {
        calendar: 'iso8601',
        day: '2-digit',
        month: '2-digit',
        timeZone,
        year: 'numeric',
    }).formatToParts(date);
    const values = Object.fromEntries(
        parts
            .filter(({ type }) => type === 'year' || type === 'month' || type === 'day')
            .map(({ type, value }) => [type, Number(value)]),
    ) as Record<'year' | 'month' | 'day', number>;

    return values;
}

function getTimeZoneOffsetMs(timestamp: number, timeZone: string): number {
    const parts = new Intl.DateTimeFormat('en-US', {
        calendar: 'iso8601',
        day: '2-digit',
        hour: '2-digit',
        hourCycle: 'h23',
        minute: '2-digit',
        month: '2-digit',
        second: '2-digit',
        timeZone,
        year: 'numeric',
    }).formatToParts(new Date(timestamp));
    const values = Object.fromEntries(
        parts
            .filter(
                ({ type }) =>
                    type === 'year' ||
                    type === 'month' ||
                    type === 'day' ||
                    type === 'hour' ||
                    type === 'minute' ||
                    type === 'second',
            )
            .map(({ type, value }) => [type, Number(value)]),
    ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>;

    return (
        Date.UTC(
            values.year,
            values.month - 1,
            values.day,
            values.hour,
            values.minute,
            values.second,
        ) - timestamp
    );
}

function localMidnight(year: number, month: number, day: number, timeZone: string): number {
    const utcCandidate = Date.UTC(year, month - 1, day);
    const firstOffset = getTimeZoneOffsetMs(utcCandidate, timeZone);
    const adjustedCandidate = utcCandidate - firstOffset;
    const correctedOffset = getTimeZoneOffsetMs(adjustedCandidate, timeZone);

    return utcCandidate - correctedOffset;
}

function rangeStart(now: Date, range: TelemetryRange, timeZone: string): Date {
    const currentDate = readDateParts(now, timeZone);
    const startDate = new Date(
        Date.UTC(currentDate.year, currentDate.month - 1, currentDate.day - RANGE_DAYS[range] + 1),
    );

    return new Date(
        localMidnight(
            startDate.getUTCFullYear(),
            startDate.getUTCMonth() + 1,
            startDate.getUTCDate(),
            timeZone,
        ),
    );
}

function createTrend(
    now: Date,
    range: TelemetryRange,
    timeZone: string,
    rates: ReadonlyMap<string, ModelRate>,
    usageBuckets: TelemetryUsageBucket[],
): TelemetryTrendPoint[] {
    const start = rangeStart(now, range, timeZone);
    const bucketMs = range === '1d' ? 60 * 60 * 1_000 : 24 * 60 * 60 * 1_000;
    const bucketCount = Math.ceil((now.getTime() - start.getTime()) / bucketMs);
    const buckets = Array.from({ length: Math.max(bucketCount, 1) }, (_, index) => ({
        startAt: start.getTime() + index * bucketMs,
        totals: createUsageTotals(),
    }));

    for (const usageBucket of usageBuckets) {
        const index = Math.floor(
            (new Date(usageBucket.startAt).getTime() - start.getTime()) / bucketMs,
        );
        const bucket = buckets[index];

        if (bucket) {
            addUsageBucket(bucket.totals, usageBucket, rates);
        }
    }

    return buckets.map(({ startAt, totals }) => ({
        startAt: new Date(startAt).toISOString(),
        label: new Date(startAt).toLocaleDateString('en', {
            month: 'short',
            day: 'numeric',
            ...(range === '1d' ? { hour: 'numeric' } : {}),
            timeZone,
        }),
        totalTokens: totals.inputTokens + totals.outputTokens,
        estimatedCostUsd: toCost(totals),
    }));
}

export class GetTelemetryOverviewUseCase {
    public constructor(
        private readonly repository: TelemetryProjectionQueryRepository,
        private readonly modelRateRepository: ModelRateQueryRepository,
        private readonly now: () => Date = () => new Date(),
    ) {}

    public execute(
        range: TelemetryRange = '7d',
        model: string | null = null,
        timeZone = 'UTC',
    ): TelemetryOverview {
        const now = this.now();
        const cutoff = rangeStart(now, range, timeZone).toISOString();
        const rates = new Map(
            this.modelRateRepository
                .listModelRates()
                .map((rate) => [rate.model.toLowerCase(), rate] as const),
        );
        const usageBuckets = this.repository.listUsageBuckets(cutoff, model);
        const conversationProjections = this.repository.listConversationProjections(cutoff, model);
        const totals = createUsageTotals();

        for (const usageBucket of usageBuckets) {
            addUsageBucket(totals, usageBucket, rates);
        }

        const conversations = conversationProjections
            .map((projection) => toTelemetryConversation(projection, rates))
            .sort((left, right) => right.lastActivityAt.localeCompare(left.lastActivityAt));
        const summary: TelemetrySummary = {
            inputTokens: totals.inputTokens,
            cachedInputTokens: totals.cachedInputTokens,
            outputTokens: totals.outputTokens,
            reasoningTokens: totals.reasoningTokens,
            toolTokens: totals.toolTokens,
            totalTokens: totals.inputTokens + totals.outputTokens,
            estimatedCostUsd: toCost(totals),
            unpricedModels: totals.unpricedModels,
            conversationCount: conversations.length,
            completedResponses: totals.completedResponses,
            averageTtftMs: toAverageTtft(totals.ttftTotalMs, totals.ttftCount),
        };

        return {
            range,
            model,
            availableModels: this.repository.listAvailableModels(cutoff),
            generatedAt: now.toISOString(),
            summary,
            trend: createTrend(now, range, timeZone, rates, usageBuckets),
            conversations,
        };
    }
}
