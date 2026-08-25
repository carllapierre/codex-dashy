import { describe, expect, it, vi } from 'vitest';
import type { OtlpBatch, OtlpLogsDecoder } from '../../domain/telemetry/otel-batch';
import { IngestOtelLogsUseCase } from './ingest-otel-logs.use-case';

const batch: OtlpBatch = {
    dedupeKey: 'batch-1',
    receivedAt: '2026-08-25T00:00:00.000Z',
    eventCount: 1,
    eventNames: ['codex.user_prompt'],
    conversationIds: ['conversation-1'],
    models: ['gpt-5.6-luna'],
    projectCandidates: [],
    events: [],
    sanitizedPayload: {},
};

describe('IngestOtelLogsUseCase', () => {
    it('notifies usage refresh when a new batch is accepted', () => {
        const decoder: OtlpLogsDecoder = { decode: vi.fn().mockReturnValue(batch) };
        const repository = { save: vi.fn().mockReturnValue(true) };
        const activityNotifier = { notifyActivity: vi.fn() };
        const useCase = new IngestOtelLogsUseCase(decoder, repository, activityNotifier);

        const result = useCase.execute({});

        expect(result.accepted).toBe(true);
        expect(activityNotifier.notifyActivity).toHaveBeenCalledOnce();
    });

    it('does not notify usage refresh for a duplicate batch', () => {
        const decoder: OtlpLogsDecoder = { decode: vi.fn().mockReturnValue(batch) };
        const repository = { save: vi.fn().mockReturnValue(false) };
        const activityNotifier = { notifyActivity: vi.fn() };
        const useCase = new IngestOtelLogsUseCase(decoder, repository, activityNotifier);

        useCase.execute({});

        expect(activityNotifier.notifyActivity).not.toHaveBeenCalled();
    });
});
