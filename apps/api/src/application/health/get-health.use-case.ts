import type { HealthStatus } from '../../domain/health/health-status';

export type HealthDependencies = {
    isDatabaseHealthy: () => boolean;
    now: () => Date;
};

export class GetHealthUseCase {
    public constructor(private readonly dependencies: HealthDependencies) {}

    public execute(): HealthStatus {
        const databaseHealthy = this.dependencies.isDatabaseHealthy();

        if (!databaseHealthy) {
            throw new Error('Database health check failed');
        }

        return {
            status: 'ok',
            service: 'codex-dashy-api',
            timestamp: this.dependencies.now().toISOString(),
            database: 'ok',
        };
    }
}
