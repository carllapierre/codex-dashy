import { describe, expect, it, vi } from 'vitest';
import { GetHealthUseCase } from './get-health.use-case';

describe('GetHealthUseCase', () => {
    it('returns a healthy status with a deterministic timestamp', () => {
        const useCase = new GetHealthUseCase({
            isDatabaseHealthy: () => true,
            now: () => new Date('2026-01-01T00:00:00.000Z'),
        });

        expect(useCase.execute()).toEqual({
            status: 'ok',
            service: 'codex-dashy-api',
            timestamp: '2026-01-01T00:00:00.000Z',
            database: 'ok',
        });
    });

    it('fails when the database is unhealthy', () => {
        const useCase = new GetHealthUseCase({
            isDatabaseHealthy: vi.fn(() => false),
            now: () => new Date('2026-01-01T00:00:00.000Z'),
        });

        expect(() => useCase.execute()).toThrow('Database health check failed');
    });
});
