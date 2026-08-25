import fs from 'node:fs';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { GetHealthUseCase } from './application/health/get-health.use-case';
import { loadConfig, type AppConfig } from './infrastructure/config/env';
import { SqliteDatabase } from './infrastructure/persistence/sqlite/sqlite-database';
import { HealthController } from './interface/http/controllers/health.controller';
import { registerHealthRoutes } from './interface/http/routes/health.routes';

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
