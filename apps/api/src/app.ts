import fs from 'node:fs';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { GetHealthUseCase } from './application/health/get-health.use-case';
import { GetModelRatesUseCase } from './application/settings/get-model-rates.use-case';
import { GetTelemetryOverviewUseCase } from './application/telemetry/get-telemetry-overview.use-case';
import { IngestOtelLogsUseCase } from './application/telemetry/ingest-otel-logs.use-case';
import { UpdateModelRateUseCase } from './application/settings/update-model-rate.use-case';
import { loadConfig, type AppConfig } from './infrastructure/config/env';
import { SqliteDatabase } from './infrastructure/persistence/sqlite/sqlite-database';
import { HealthController } from './interface/http/controllers/health.controller';
import { ModelRatesController } from './interface/http/controllers/model-rates.controller';
import { OtelLogsController } from './interface/http/controllers/otel-logs.controller';
import { TelemetryOverviewController } from './interface/http/controllers/telemetry-overview.controller';
import { registerHealthRoutes } from './interface/http/routes/health.routes';
import { registerModelRatesRoutes } from './interface/http/routes/model-rates.routes';
import { registerOtelRoutes } from './interface/http/routes/otel.routes';
import { registerTelemetryRoutes } from './interface/http/routes/telemetry.routes';
import { otlpJsonDecoder } from './infrastructure/telemetry/otlp-json.decoder';

export type AppDependencies = {
    config?: AppConfig;
    database?: SqliteDatabase;
};

export async function createApp(dependencies: AppDependencies = {}): Promise<FastifyInstance> {
    const config = dependencies.config ?? loadConfig();
    const database = dependencies.database ?? new SqliteDatabase(config.databaseFile);
    const app = Fastify({ logger: true });

    await app.register(fastifyCors, { origin: config.corsOrigin });

    const getHealth = new GetHealthUseCase({
        isDatabaseHealthy: () => database.isHealthy(),
        now: () => new Date(),
    });
    await registerHealthRoutes(app, new HealthController(getHealth));

    const ingestOtelLogs = new IngestOtelLogsUseCase(otlpJsonDecoder, database);
    await registerOtelRoutes(app, new OtelLogsController(ingestOtelLogs));

    const getModelRates = new GetModelRatesUseCase(database);
    const updateModelRate = new UpdateModelRateUseCase(database);
    await registerModelRatesRoutes(app, new ModelRatesController(getModelRates, updateModelRate));

    const getTelemetryOverview = new GetTelemetryOverviewUseCase(database, database);
    await registerTelemetryRoutes(app, new TelemetryOverviewController(getTelemetryOverview));

    if (fs.existsSync(config.webDistDirectory)) {
        await app.register(fastifyStatic, {
            root: config.webDistDirectory,
            wildcard: false,
        });

        app.setNotFoundHandler((request, reply) => {
            if (request.method === 'GET' && !request.url.startsWith('/api/')) {
                return reply.sendFile('index.html');
            }

            return reply.code(404).send({ error: 'Not found' });
        });
    }

    app.addHook('onClose', async () => {
        database.close();
    });

    return app;
}
