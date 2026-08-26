import { spawn } from 'node:child_process';

const bridgeUrl = `http://${process.env.CODEX_USAGE_BRIDGE_HOST ?? '127.0.0.1'}:${process.env.CODEX_USAGE_BRIDGE_PORT ?? '8790'}`;

async function bridgeIsRunning(): Promise<boolean> {
    try {
        const response = await fetch(`${bridgeUrl}/snapshot`, {
            signal: AbortSignal.timeout(500),
        });

        return response.ok;
    } catch {
        return false;
    }
}

async function waitForShutdown(): Promise<void> {
    await new Promise<void>((resolve) => {
        const keepAlive = setInterval(() => undefined, 60_000);
        const shutdown = () => {
            clearInterval(keepAlive);
            resolve();
        };

        process.once('SIGINT', shutdown);
        process.once('SIGTERM', shutdown);
    });
}

async function startBridge(): Promise<void> {
    if (await bridgeIsRunning()) {
        console.log(`Codex usage bridge already running at ${bridgeUrl}; reusing it.`);
        await waitForShutdown();
        return;
    }

    const bridge = spawn('npm', ['run', 'codex:bridge'], { stdio: 'inherit' });
    const forwardSignal = (signal: NodeJS.Signals) => bridge.kill(signal);

    process.once('SIGINT', () => forwardSignal('SIGINT'));
    process.once('SIGTERM', () => forwardSignal('SIGTERM'));

    await new Promise<void>((resolve, reject) => {
        bridge.once('error', reject);
        bridge.once('exit', (code) => {
            if (code === 0 || code === null) {
                resolve();
                return;
            }

            reject(new Error(`Codex usage bridge exited with code ${code}.`));
        });
    });
}

startBridge().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});
