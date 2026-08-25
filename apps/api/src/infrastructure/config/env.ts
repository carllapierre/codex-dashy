import path from 'node:path';

export type AppConfig = {
    host: string;
    port: number;
    databaseFile: string;
    corsOrigin: string;
    webDistDirectory: string;
    codexUsageBridgeUrl?: string;
};

function readPort(value: string | undefined): number {
    const port = Number(value ?? '8789');

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('PORT must be an integer between 1 and 65535');
    }

    return port;
}

export function loadConfig(): AppConfig {
    const defaultWebDistDirectory = path.resolve(__dirname, '../../../../../apps/web/dist');

    return {
        host: process.env.HOST ?? '0.0.0.0',
        port: readPort(process.env.PORT),
        databaseFile: process.env.DB_FILE ?? path.resolve('data/codex-dashy.db'),
        corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
        webDistDirectory: process.env.WEB_DIST_DIR ?? defaultWebDistDirectory,
        codexUsageBridgeUrl: process.env.CODEX_USAGE_BRIDGE_URL ?? 'http://127.0.0.1:8790',
    };
}
