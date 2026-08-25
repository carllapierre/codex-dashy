import type {
    CodexUsageBucket,
    CodexUsageSnapshot,
    CodexUsageWindow,
} from '../features/telemetry/telemetry.types';

type CodexUsageLimitsProps = {
    snapshot: CodexUsageSnapshot | null;
};

type UsageCard = {
    label: string;
    remainingPercent: number;
    resetAt: number | null;
    detail: string | null;
};

function readNumber(value: unknown): number | null {
    const number = typeof value === 'number' ? value : Number(value);

    return Number.isFinite(number) ? number : null;
}

function getRemainingPercent(window: CodexUsageWindow): number | null {
    const usedPercent = readNumber(window.usedPercent);

    return usedPercent === null ? null : Math.min(Math.max(100 - usedPercent, 0), 100);
}

function getResetLabel(resetAt: number | null): string {
    if (resetAt === null) {
        return 'Reset unavailable';
    }

    return `Resets ${new Date(resetAt * 1_000).toLocaleString('en', {
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        month: 'short',
    })}`;
}

function getWindowLabel(window: CodexUsageWindow): string | null {
    const duration = readNumber(window.windowDurationMins);

    if (duration === 300) {
        return '5 hour usage limit';
    }

    if (duration === 10_080) {
        return 'Weekly usage limit';
    }

    return duration === null ? null : `${duration} minute usage limit`;
}

function findWindow(
    buckets: CodexUsageBucket[],
    durationMinutes: number,
): { window: CodexUsageWindow; bucket: CodexUsageBucket } | null {
    for (const bucket of buckets) {
        for (const window of [bucket.primary, bucket.secondary]) {
            if (window && readNumber(window.windowDurationMins) === durationMinutes) {
                return { window, bucket };
            }
        }
    }

    return null;
}

function createWindowCard(
    match: { window: CodexUsageWindow; bucket: CodexUsageBucket } | null,
): UsageCard | null {
    if (!match) {
        return null;
    }

    const remainingPercent = getRemainingPercent(match.window);
    const label = getWindowLabel(match.window);

    if (remainingPercent === null || !label) {
        return null;
    }

    const resetAt = readNumber(match.window.resetsAt);

    return {
        label,
        remainingPercent,
        resetAt,
        detail: getResetLabel(resetAt),
    };
}

function createWorkspaceCard(bucket: CodexUsageBucket | null): UsageCard | null {
    const individualLimit = bucket?.individualLimit;
    const remainingPercent =
        individualLimit && typeof individualLimit === 'object'
            ? readNumber(individualLimit.remainingPercent)
            : null;

    if (remainingPercent === null) {
        return null;
    }

    const used =
        individualLimit && typeof individualLimit.used === 'string' ? individualLimit.used : null;
    const limit =
        individualLimit && typeof individualLimit.limit === 'string' ? individualLimit.limit : null;

    return {
        label: 'Workspace allowance',
        remainingPercent: Math.min(Math.max(remainingPercent, 0), 100),
        resetAt:
            individualLimit && readNumber(individualLimit.resetsAt) !== null
                ? readNumber(individualLimit.resetsAt)
                : null,
        detail: used && limit ? `${used} of ${limit} credits used` : null,
    };
}

function UsageRing({ card }: { card: UsageCard }) {
    const circumference = 100;

    return (
        <article className="codex-usage-card">
            <div className="codex-usage-card__ring">
                <svg
                    viewBox="0 0 42 42"
                    role="img"
                    aria-label={`${card.remainingPercent}% remaining`}
                >
                    <circle
                        className="codex-usage-card__track"
                        cx="21"
                        cy="21"
                        r="16"
                        pathLength={circumference}
                    />
                    <circle
                        className="codex-usage-card__progress"
                        cx="21"
                        cy="21"
                        r="16"
                        pathLength={circumference}
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference - card.remainingPercent}
                    />
                </svg>
                <strong>{Math.round(card.remainingPercent)}%</strong>
            </div>
            <div className="codex-usage-card__content">
                <span className="detail-label">{card.label}</span>
                {card.detail ? <span className="codex-usage-card__meta">{card.detail}</span> : null}
            </div>
        </article>
    );
}

export function CodexUsageLimits({ snapshot }: CodexUsageLimitsProps) {
    if (!snapshot) {
        return null;
    }

    if (!snapshot.available) {
        return (
            <section className="codex-usage-panel content-card" aria-label="Usage limits">
                <div className="section-heading">
                    <div>
                        <p className="eyebrow">Usage limits</p>
                        <h2>Usage limits unavailable</h2>
                    </div>
                </div>
                <p className="codex-usage-panel__empty">
                    Start the local Codex usage bridge to see your authenticated limits here.
                </p>
            </section>
        );
    }

    const buckets = snapshot.rateLimitsByLimitId
        ? Object.values(snapshot.rateLimitsByLimitId)
        : snapshot.rateLimits
          ? [snapshot.rateLimits]
          : [];
    const cards = [
        createWindowCard(findWindow(buckets, 300)),
        createWindowCard(findWindow(buckets, 10_080)),
        createWorkspaceCard(snapshot.rateLimits),
    ].filter((card): card is UsageCard => card !== null);

    return (
        <section className="codex-usage-panel content-card" aria-label="Usage limits">
            <div className="section-heading">
                <p className="eyebrow">Usage limits</p>
                <span className="muted-label">
                    {snapshot.fetchedAt
                        ? `Updated ${new Date(snapshot.fetchedAt).toLocaleTimeString()}`
                        : 'Live'}
                </span>
            </div>
            {cards.length > 0 ? (
                <div className="codex-usage-grid">
                    {cards.map((card) => (
                        <UsageRing key={card.label} card={card} />
                    ))}
                </div>
            ) : (
                <p className="codex-usage-panel__empty">
                    Codex returned no displayable usage windows yet.
                </p>
            )}
        </section>
    );
}
