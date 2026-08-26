import { describe, expect, it, vi } from 'vitest';
import { GetHealthUseCase } from './get-health.use-case';

describe('GetHealthUseCase', () => {
    it('returns a healthy status with a deterministic timestamp', () => {
        const useCase = new GetHealthUseCase({
            isDatabaseHealthy: () => true,
            isDatabaseIntegrityHealthy: () => true,
            now: () => new Date('2026-01-01T00:00:00.000Z'),
        });

        expect(useCase.execute()).toEqual({
            status: 'ok',
            service: 'codex-dashy-api',
            timestamp: '2026-01-01T00:00:00.000Z',
            database: 'ok',
            databaseIntegrity: 'ok',
        });
    });

    it('reports degraded status when the database integrity check fails', () => {
        const useCase = new GetHealthUseCase({
            isDatabaseHealthy: () => true,
            isDatabaseIntegrityHealthy: () => false,
            now: () => new Date('2026-01-01T00:00:00.000Z'),
        });

        expect(useCase.execute()).toEqual({
            status: 'degraded',
            service: 'codex-dashy-api',
            timestamp: '2026-01-01T00:00:00.000Z',
            database: 'ok',
            databaseIntegrity: 'failed',
        });
    });

    it('fails when the database is unhealthy', () => {
        const useCase = new GetHealthUseCase({
            isDatabaseHealthy: vi.fn(() => false),
            isDatabaseIntegrityHealthy: () => true,
            now: () => new Date('2026-01-01T00:00:00.000Z'),
        });

        expect(() => useCase.execute()).toThrow('Database health check failed');
    });
});
