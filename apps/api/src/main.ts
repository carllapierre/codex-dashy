import 'dotenv/config';
import { createApp } from './app';
import { loadConfig } from './infrastructure/config/env';

async function main(): Promise<void> {
    const config = loadConfig();
    const app = await createApp({ config });

    await app.listen({ host: config.host, port: config.port });
}

main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});
