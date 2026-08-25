export type CodexRateLimitWindow = {
    usedPercent?: number;
    windowDurationMins?: number;
    resetsAt?: number;
    [key: string]: unknown;
};

export type CodexRateLimitBucket = {
    limitId?: string;
    limitName?: string | null;
    primary?: CodexRateLimitWindow | null;
    secondary?: CodexRateLimitWindow | null;
    credits?: Record<string, unknown> | null;
    individualLimit?: Record<string, unknown> | null;
    planType?: string | null;
    spendControlReached?: boolean;
    rateLimitReachedType?: string | null;
    [key: string]: unknown;
};

export type CodexUsageSnapshot = {
    available: boolean;
    fetchedAt: string | null;
    rateLimits: CodexRateLimitBucket | null;
    rateLimitsByLimitId: Record<string, CodexRateLimitBucket> | null;
    rateLimitResetCredits: Record<string, unknown> | null;
    usage: Record<string, unknown> | null;
    error: string | null;
};

export type CodexUsageQuery = {
    getSnapshot: () => Promise<CodexUsageSnapshot>;
};
