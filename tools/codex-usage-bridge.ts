import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

type JsonObject = Record<string, unknown>;

export type CodexBridgeSnapshot = {
    available: boolean;
    fetchedAt: string | null;
    rateLimits: JsonObject | null;
    rateLimitsByLimitId: Record<string, JsonObject> | null;
    rateLimitResetCredits: JsonObject | null;
    usage: JsonObject | null;
    error: string | null;
};

type PendingRequest = {
    reject: (error: Error) => void;
    resolve: (value: JsonObject) => void;
    timeout: ReturnType<typeof setTimeout>;
};

const host = process.env.CODEX_USAGE_BRIDGE_HOST ?? '127.0.0.1';
const port = Number(process.env.CODEX_USAGE_BRIDGE_PORT ?? '8790');
const codexBinary = process.env.CODEX_BINARY ?? 'codex';
const requestTimeoutMs = 15_000;

const unavailableSnapshot = (): CodexBridgeSnapshot => ({
    available: false,
    fetchedAt: null,
    rateLimits: null,
    rateLimitsByLimitId: null,
    rateLimitResetCredits: null,
    usage: null,
    error: 'Codex app-server is not connected.',
});

class CodexAppServerClient {
    private process: ChildProcessWithoutNullStreams | null = null;
    private buffer = '';
    private nextRequestId = 1;
    private readonly pending = new Map<number, PendingRequest>();
    private snapshot = unavailableSnapshot();
    private stopping = false;

    public getSnapshot(): CodexBridgeSnapshot {
        return this.snapshot;
    }

    public async start(): Promise<void> {
        this.stopping = false;
        this.startProcess();
    }

    public async stop(): Promise<void> {
        this.stopping = true;
        this.process?.kill();
        this.process = null;

        for (const pending of this.pending.values()) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Codex app-server stopped.'));
        }
        this.pending.clear();
    }

    private startProcess(): void {
        if (this.stopping || this.process) {
            return;
        }

        const child = spawn(codexBinary, ['app-server', '--stdio'], {
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        this.process = child;
        this.snapshot = { ...unavailableSnapshot(), error: null };

        child.stdout.on('data', (chunk: Buffer | string) => {
            this.buffer += chunk.toString();
            this.readLines();
        });
        child.stderr.on('data', () => {
            // App-server diagnostics stay local and are intentionally not exposed by the bridge.
        });
        child.once('error', (error) => {
            this.snapshot = { ...unavailableSnapshot(), error: error.message };
        });
        child.once('exit', () => {
            this.process = null;
            this.snapshot = { ...unavailableSnapshot(), error: 'Codex app-server disconnected.' };

            for (const pending of this.pending.values()) {
                clearTimeout(pending.timeout);
                pending.reject(new Error('Codex app-server disconnected.'));
            }
            this.pending.clear();

            if (!this.stopping) {
                setTimeout(() => this.startProcess(), 5_000);
            }
        });

        void this.initializeAndRefresh().catch((error: unknown) => {
            this.snapshot = {
                ...unavailableSnapshot(),
                error: error instanceof Error ? error.message : 'Unable to query Codex.',
            };
            child.kill();
        });
    }

    private async initializeAndRefresh(): Promise<void> {
        await this.request('initialize', {
            clientInfo: {
                name: 'codex-dashy-usage-bridge',
                title: 'Codex Dashy Usage Bridge',
                version: '0.1.0',
            },
        });
        this.notify('initialized');

        const [rateLimits, usage] = await Promise.all([
            this.request('account/rateLimits/read'),
            this.request('account/usage/read'),
        ]);
        this.applyRateLimits(rateLimits.result as JsonObject | undefined);
        this.applyUsage(usage.result as JsonObject | undefined);
    }

    private request(method: string, params?: JsonObject): Promise<JsonObject> {
        const id = this.nextRequestId++;
        const child = this.process;

        if (!child) {
            return Promise.reject(new Error('Codex app-server is not connected.'));
        }

        return new Promise<JsonObject>((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`Codex request timed out: ${method}`));
            }, requestTimeoutMs);
            this.pending.set(id, { reject, resolve, timeout });
            child.stdin.write(`${JSON.stringify({ method, id, ...(params ? { params } : {}) })}\n`);
        });
    }

    private notify(method: string, params?: JsonObject): void {
        this.process?.stdin.write(`${JSON.stringify({ method, ...(params ? { params } : {}) })}\n`);
    }

    private readLines(): void {
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() ?? '';

        for (const line of lines) {
            if (!line.trim()) {
                continue;
            }

            try {
                this.handleMessage(JSON.parse(line) as JsonObject);
            } catch {
                this.snapshot = { ...this.snapshot, error: 'Codex returned an invalid response.' };
            }
        }
    }

    private handleMessage(message: JsonObject): void {
        if (message.method === 'account/rateLimits/updated') {
            this.applyRateLimits(message.params as JsonObject | undefined);
        }

        if (typeof message.id !== 'number') {
            return;
        }

        const pending = this.pending.get(message.id);
        if (!pending) {
            return;
        }

        this.pending.delete(message.id);
        clearTimeout(pending.timeout);

        if (message.error && typeof message.error === 'object') {
            const error = message.error as JsonObject;
            pending.reject(new Error(String(error.message ?? 'Codex request failed.')));
            return;
        }

        pending.resolve(message);
    }

    private applyRateLimits(result: JsonObject | undefined): void {
        if (!result) {
            return;
        }

        const nextRateLimits = result.rateLimits as JsonObject | undefined;
        const nextBuckets = result.rateLimitsByLimitId as Record<string, JsonObject> | undefined;

        this.snapshot = {
            ...this.snapshot,
            available: true,
            fetchedAt: new Date().toISOString(),
            rateLimits: nextRateLimits ?? this.snapshot.rateLimits,
            rateLimitsByLimitId: nextBuckets ?? this.snapshot.rateLimitsByLimitId,
            rateLimitResetCredits:
                (result.rateLimitResetCredits as JsonObject | null | undefined) ??
                this.snapshot.rateLimitResetCredits,
            error: null,
        };
    }

    private applyUsage(result: JsonObject | undefined): void {
        if (!result) {
            return;
        }

        this.snapshot = {
            ...this.snapshot,
            usage: result,
            fetchedAt: new Date().toISOString(),
        };
    }
}

function sendJson(response: ServerResponse, statusCode: number, body: JsonObject): void {
    response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
    });
    response.end(JSON.stringify(body));
}

function handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
    client: CodexAppServerClient,
): void {
    if (request.method !== 'GET' || request.url !== '/snapshot') {
        sendJson(response, 404, { error: 'Not found' });
        return;
    }

    sendJson(response, 200, client.getSnapshot() as unknown as JsonObject);
}

async function main(): Promise<void> {
    const client = new CodexAppServerClient();
    const server = createServer((request, response) => handleRequest(request, response, client));

    server.listen(port, host, () => {
        console.log(`Codex usage bridge listening on http://${host}:${port}`);
    });
    await client.start();

    const shutdown = async () => {
        await client.stop();
        server.close();
    };
    process.once('SIGINT', () => void shutdown());
    process.once('SIGTERM', () => void shutdown());
}

void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});
