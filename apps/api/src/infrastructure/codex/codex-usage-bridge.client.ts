import type {
    CodexRateLimitBucket,
    CodexUsageQuery,
    CodexUsageSnapshot,
} from '../../domain/codex/codex-usage';
import type { TelemetryActivityNotifier } from '../../domain/telemetry/otel-batch';

function unavailable(error: string): CodexUsageSnapshot {
    return {
        available: false,
        fetchedAt: null,
        rateLimits: null,
        rateLimitsByLimitId: null,
        rateLimitResetCredits: null,
        usage: null,
        error,
    };
}

function readSnapshot(value: unknown): CodexUsageSnapshot | null {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const snapshot = value as Record<string, unknown>;
    const rateLimits = snapshot.rateLimits;
    const buckets = snapshot.rateLimitsByLimitId;

    return {
        available: snapshot.available === true,
        fetchedAt: typeof snapshot.fetchedAt === 'string' ? snapshot.fetchedAt : null,
        rateLimits:
            rateLimits && typeof rateLimits === 'object'
                ? (rateLimits as CodexRateLimitBucket)
                : null,
        rateLimitsByLimitId:
            buckets && typeof buckets === 'object'
                ? (buckets as Record<string, CodexRateLimitBucket>)
                : null,
        rateLimitResetCredits:
            snapshot.rateLimitResetCredits && typeof snapshot.rateLimitResetCredits === 'object'
                ? (snapshot.rateLimitResetCredits as Record<string, unknown>)
                : null,
        usage:
            snapshot.usage && typeof snapshot.usage === 'object'
                ? (snapshot.usage as Record<string, unknown>)
                : null,
        error: typeof snapshot.error === 'string' ? snapshot.error : null,
    };
}

export class CodexUsageBridgeClient implements CodexUsageQuery, TelemetryActivityNotifier {
    private lastActivityNotificationAt = 0;

    public constructor(private readonly bridgeUrl: string | undefined) {}

    public notifyActivity(): void {
        if (!this.bridgeUrl || Date.now() - this.lastActivityNotificationAt < 1_000) {
            return;
        }

        this.lastActivityNotificationAt = Date.now();
        void fetch(`${this.bridgeUrl}/activity`, {
            method: 'POST',
            signal: AbortSignal.timeout(1_000),
        }).catch(() => {
            // The dashboard remains functional when the optional usage bridge is unavailable.
        });
    }

    public async getSnapshot(): Promise<CodexUsageSnapshot> {
        if (!this.bridgeUrl) {
            return unavailable('Codex usage bridge is not configured.');
        }

        try {
            const response = await fetch(`${this.bridgeUrl}/snapshot`, {
                signal: AbortSignal.timeout(3_000),
            });

            if (!response.ok) {
                return unavailable(`Codex usage bridge returned HTTP ${response.status}.`);
            }

            return readSnapshot(await response.json()) ?? unavailable('Invalid bridge response.');
        } catch (error) {
            return unavailable(
                error instanceof Error ? error.message : 'Unable to reach Codex usage bridge.',
            );
        }
    }
}
