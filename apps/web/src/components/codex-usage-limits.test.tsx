import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CodexUsageLimits } from './codex-usage-limits';

describe('CodexUsageLimits', () => {
    afterEach(() => {
        cleanup();
    });

    it('renders real remaining percentages and reset details', () => {
        render(
            <CodexUsageLimits
                snapshot={{
                    available: true,
                    fetchedAt: '2026-08-25T19:00:00.000Z',
                    rateLimits: {
                        individualLimit: {
                            remainingPercent: 100,
                            used: '0.0',
                            limit: '1000',
                            resetsAt: 1788220800,
                        },
                    },
                    rateLimitsByLimitId: {
                        codex: {
                            primary: {
                                usedPercent: 4,
                                windowDurationMins: 300,
                                resetsAt: 1787704851,
                            },
                            secondary: {
                                usedPercent: 7,
                                windowDurationMins: 10080,
                                resetsAt: 1788273647,
                            },
                            planType: 'team',
                        },
                    },
                    rateLimitResetCredits: null,
                    usage: null,
                    error: null,
                }}
            />,
        );

        expect(screen.getByText('Usage limits')).toBeVisible();
        expect(screen.getByText('5 hour usage limit')).toBeVisible();
        expect(screen.getByRole('img', { name: '96% remaining' })).toBeVisible();
        expect(screen.getAllByText(/^Resets /)).toHaveLength(2);
        expect(screen.getByText('Weekly usage limit')).toBeVisible();
        expect(screen.getByRole('img', { name: '93% remaining' })).toBeVisible();
        expect(screen.getByText('Workspace allowance')).toBeVisible();
        expect(screen.getByText('0.0 of 1000 credits used')).toBeVisible();
        expect(screen.getAllByRole('article')[0]).not.toHaveAttribute('title');
    });

    it('shows an explicit unavailable state without inventing values', () => {
        render(
            <CodexUsageLimits
                snapshot={{
                    available: false,
                    fetchedAt: null,
                    rateLimits: null,
                    rateLimitsByLimitId: null,
                    rateLimitResetCredits: null,
                    usage: null,
                    error: 'connect refused',
                }}
            />,
        );

        expect(screen.getByRole('heading', { name: 'Usage limits unavailable' })).toBeVisible();
        expect(screen.queryByText(/% remaining/)).not.toBeInTheDocument();
    });
});
