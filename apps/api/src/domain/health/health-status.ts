export type HealthStatus = {
    status: 'ok' | 'degraded';
    service: string;
    timestamp: string;
    database: 'ok';
    databaseIntegrity: 'ok' | 'failed';
};
