import type {
    OtlpBatch,
    OtlpBatchQueryRepository,
    TelemetryAttribute,
} from '../../domain/telemetry/otel-batch';
import {
    type TelemetryConversation,
    type TelemetryOverview,
    type TelemetryRange,
    type TelemetrySummary,
    type TelemetryTrendPoint,
} from '../../domain/telemetry/telemetry-overview';
import { calculateEstimatedCostUsd } from '../../infrastructure/telemetry/model-rates';

const RANGE_DAYS: Record<TelemetryRange, number> = {
    '1d': 1,
    '7d': 7,
    '30d': 30,
};

type UsageAccumulator = {
    id: string;
    initialPrompt: string | null;
    startedAt: number;
    lastActivityAt: number;
    model: string | null;
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    toolTokens: number;
    completedResponses: number;
    ttftValues: number[];
    estimatedCostUsd: number;
    hasUnknownRate: boolean;
};

type UsageTotals = Omit<UsageAccumulator, 'id' | 'initialPrompt' | 'startedAt' | 'lastActivityAt'>;

function readNumber(attributes: Record<string, TelemetryAttribute>, key: string): number {
    const value = attributes[key];
    const number = typeof value === 'number' ? value : Number(value);

    return Number.isFinite(number) && number >= 0 ? number : 0;
}

function readString(attributes: Record<string, TelemetryAttribute>, key: string): string | null {
    const value = attributes[key];

    return typeof value === 'string' && value.length > 0 ? value : null;
}

function isTitleGenerationPrompt(prompt: string): boolean {
    return prompt.includes('Generate a concise UI title') && prompt.includes('User prompt:');
}

function readUserPrompt(attributes: Record<string, TelemetryAttribute>): string | null {
    const prompt = readString(attributes, 'prompt');

    if (!prompt) {
        return null;
    }

    if (!isTitleGenerationPrompt(prompt)) {
        return prompt;
    }

    return prompt.slice(prompt.lastIndexOf('User prompt:') + 'User prompt:'.length).trim() || null;
}

function readDate(value: string | null | undefined): Date | null {
    if (!value) {
        return null;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
}

function createAccumulator(id: string, timestamp: number): UsageAccumulator {
    return {
        id,
        initialPrompt: null,
        startedAt: timestamp,
        lastActivityAt: timestamp,
        model: null,
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        toolTokens: 0,
        completedResponses: 0,
        ttftValues: [],
        estimatedCostUsd: 0,
        hasUnknownRate: false,
    };
}

function createTotals(): UsageTotals {
    return {
        model: null,
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        toolTokens: 0,
        completedResponses: 0,
        ttftValues: [],
        estimatedCostUsd: 0,
        hasUnknownRate: false,
    };
}

function addTokenUsage(
    totals: UsageTotals,
    model: string | null,
    attributes: Record<string, TelemetryAttribute>,
): void {
    const inputTokens = readNumber(attributes, 'input_token_count');
    const cachedInputTokens = readNumber(attributes, 'cached_token_count');
    const outputTokens = readNumber(attributes, 'output_token_count');
    const reasoningTokens = readNumber(attributes, 'reasoning_token_count');
    const toolTokens = readNumber(attributes, 'tool_token_count');

    totals.model ??= model;
    totals.inputTokens += inputTokens;
    totals.cachedInputTokens += cachedInputTokens;
    totals.outputTokens += outputTokens;
    totals.reasoningTokens += reasoningTokens;
    totals.toolTokens += toolTokens;
    totals.completedResponses += 1;

    const cost = calculateEstimatedCostUsd(model, inputTokens, cachedInputTokens, outputTokens);
    if (cost === null && inputTokens + outputTokens > 0) {
        totals.hasUnknownRate = true;
    } else if (cost !== null) {
        totals.estimatedCostUsd += cost;
    }
}

function toCost(totals: UsageTotals): number | null {
    if (totals.inputTokens + totals.outputTokens === 0 || totals.hasUnknownRate) {
        return null;
    }

    return totals.estimatedCostUsd;
}

function toAverage(values: number[]): number | null {
    if (values.length === 0) {
        return null;
    }

    return values.reduce((total, value) => total + value, 0) / values.length;
}

function toConversation(accumulator: UsageAccumulator): TelemetryConversation {
    const totals: UsageTotals = {
        model: accumulator.model,
        inputTokens: accumulator.inputTokens,
        cachedInputTokens: accumulator.cachedInputTokens,
        outputTokens: accumulator.outputTokens,
        reasoningTokens: accumulator.reasoningTokens,
        toolTokens: accumulator.toolTokens,
        completedResponses: accumulator.completedResponses,
        ttftValues: accumulator.ttftValues,
        estimatedCostUsd: accumulator.estimatedCostUsd,
        hasUnknownRate: accumulator.hasUnknownRate,
    };

    return {
        id: accumulator.id,
        initialPrompt: accumulator.initialPrompt,
        startedAt: new Date(accumulator.startedAt).toISOString(),
        lastActivityAt: new Date(accumulator.lastActivityAt).toISOString(),
        model: accumulator.model,
        inputTokens: accumulator.inputTokens,
        cachedInputTokens: accumulator.cachedInputTokens,
        outputTokens: accumulator.outputTokens,
        reasoningTokens: accumulator.reasoningTokens,
        toolTokens: accumulator.toolTokens,
        totalTokens: accumulator.inputTokens + accumulator.outputTokens,
        estimatedCostUsd: toCost(totals),
        completedResponses: accumulator.completedResponses,
        averageTtftMs: toAverage(accumulator.ttftValues),
    };
}

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
    events: Array<{
        timestamp: number;
        model: string | null;
        attributes: Record<string, TelemetryAttribute>;
    }>,
): TelemetryTrendPoint[] {
    const start = rangeStart(now, range, timeZone);
    const bucketMs = range === '1d' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const bucketCount = Math.ceil((now.getTime() - start.getTime()) / bucketMs);
    const buckets = Array.from({ length: Math.max(bucketCount, 1) }, (_, index) => ({
        startAt: start.getTime() + index * bucketMs,
        totals: createTotals(),
    }));

    for (const event of events) {
        const index = Math.floor((event.timestamp - start.getTime()) / bucketMs);
        const bucket = buckets[index];

        if (bucket) {
            addTokenUsage(bucket.totals, event.model, event.attributes);
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

function getStoredEvents(batches: OtlpBatch[], cutoff: number) {
    return batches.flatMap((batch) =>
        batch.events.flatMap((event) => {
            const timestamp =
                readDate(event.observedAt)?.getTime() ?? new Date(batch.receivedAt).getTime();

            if (timestamp < cutoff) {
                return [];
            }

            return [{ ...event, timestamp }];
        }),
    );
}

export class GetTelemetryOverviewUseCase {
    public constructor(
        private readonly repository: OtlpBatchQueryRepository,
        private readonly now: () => Date = () => new Date(),
    ) {}

    public execute(
        range: TelemetryRange = '7d',
        model: string | null = null,
        timeZone = 'UTC',
    ): TelemetryOverview {
        const now = this.now();
        const cutoff = rangeStart(now, range, timeZone).getTime();
        const storedEvents = getStoredEvents(this.repository.list(), Number.NEGATIVE_INFINITY);
        const internalConversationIds = new Set(
            storedEvents
                .filter(
                    (event) =>
                        event.eventName === 'codex.user_prompt' &&
                        event.conversationId !== null &&
                        isTitleGenerationPrompt(readString(event.attributes, 'prompt') ?? ''),
                )
                .map((event) => event.conversationId as string),
        );
        const allEvents = storedEvents.filter((event) => event.timestamp >= cutoff);
        const visibleEvents = allEvents.filter(
            (event) => !internalConversationIds.has(event.conversationId ?? ''),
        );
        const availableModels = [
            ...new Set(visibleEvents.map((event) => event.model).filter(Boolean)),
        ] as string[];
        const filteredEvents = model
            ? visibleEvents.filter((event) => event.model === model)
            : visibleEvents;
        const conversations = new Map<string, UsageAccumulator>();
        const totals = createTotals();
        const tokenEvents: Array<{
            timestamp: number;
            model: string | null;
            attributes: Record<string, TelemetryAttribute>;
        }> = [];

        for (const event of filteredEvents) {
            const conversationId = event.conversationId;
            const attributes = event.attributes;

            if (event.eventName === 'codex.sse_event' && 'input_token_count' in attributes) {
                addTokenUsage(totals, event.model, attributes);
                tokenEvents.push({ timestamp: event.timestamp, model: event.model, attributes });

                if (conversationId) {
                    const accumulator =
                        conversations.get(conversationId) ??
                        createAccumulator(conversationId, event.timestamp);
                    addTokenUsage(accumulator, event.model, attributes);
                    conversations.set(conversationId, accumulator);
                }
            }

            if (conversationId) {
                const accumulator =
                    conversations.get(conversationId) ??
                    createAccumulator(conversationId, event.timestamp);
                accumulator.startedAt = Math.min(accumulator.startedAt, event.timestamp);
                accumulator.lastActivityAt = Math.max(accumulator.lastActivityAt, event.timestamp);
                accumulator.model ??= event.model;

                if (event.eventName === 'codex.user_prompt') {
                    accumulator.initialPrompt ??= readUserPrompt(attributes);
                }

                if (event.eventName === 'codex.turn_ttft') {
                    const duration = readNumber(attributes, 'duration_ms');
                    if (duration > 0) {
                        accumulator.ttftValues.push(duration);
                        totals.ttftValues.push(duration);
                    }
                }

                conversations.set(conversationId, accumulator);
            }
        }

        const conversationList = [...conversations.values()]
            .map(toConversation)
            .sort((left, right) => right.lastActivityAt.localeCompare(left.lastActivityAt));
        const summary: TelemetrySummary = {
            inputTokens: totals.inputTokens,
            cachedInputTokens: totals.cachedInputTokens,
            outputTokens: totals.outputTokens,
            reasoningTokens: totals.reasoningTokens,
            toolTokens: totals.toolTokens,
            totalTokens: totals.inputTokens + totals.outputTokens,
            estimatedCostUsd: toCost(totals),
            conversationCount: conversationList.length,
            completedResponses: totals.completedResponses,
            averageTtftMs: toAverage(totals.ttftValues),
        };

        return {
            range,
            model,
            availableModels,
            generatedAt: now.toISOString(),
            summary,
            trend: createTrend(now, range, timeZone, tokenEvents),
            conversations: conversationList,
        };
    }
}
