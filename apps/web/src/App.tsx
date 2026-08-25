import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyChart } from './components/empty-chart';
import { Sidebar } from './components/sidebar';
import { UsageChart } from './components/usage-chart';
import { StatCard } from './components/ui/stat-card';
import type {
    TelemetryConversation,
    TelemetryOverview,
    TelemetryRange,
} from './features/telemetry/telemetry.types';

const rangeOptions: Array<{ value: TelemetryRange; label: string }> = [
    { value: '1d', label: '1 day' },
    { value: '7d', label: '1 week' },
    { value: '30d', label: '1 month' },
];

const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 4,
});

function formatCurrency(value: number): string {
    return currencyFormatter.format(value);
}

function formatDate(value: string): string {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? 'Unknown time'
        : new Intl.DateTimeFormat('en', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
          }).format(date);
}

function formatDuration(value: number | null): string {
    return value === null ? '—' : `${Math.round(value)} ms`;
}

function formatMilliseconds(value: number): string {
    return Math.round(value).toLocaleString('en-US');
}

function ConversationDetail({ conversation }: { conversation: TelemetryConversation | null }) {
    if (!conversation) {
        return (
            <section className="content-card empty-state">
                <div className="empty-state__orb" aria-hidden="true">
                    ✦
                </div>
                <h2>Select a conversation</h2>
                <p>Choose a conversation from the sidebar to inspect its prompt and usage.</p>
            </section>
        );
    }

    return (
        <section className="content-card conversation-detail" aria-label="Conversation details">
            <div className="section-heading">
                <div>
                    <p className="eyebrow">Conversation detail</p>
                    <h2>{conversation.model ?? 'Model unavailable'}</h2>
                </div>
                <span className="muted-label">{formatDate(conversation.lastActivityAt)}</span>
            </div>
            <div className="conversation-detail__prompt">
                <span className="detail-label">Initial prompt</span>
                <p>{conversation.initialPrompt ?? 'Prompt unavailable'}</p>
            </div>
            <div className="conversation-detail__metrics">
                <div>
                    <span className="detail-label">Total tokens</span>
                    <strong>{conversation.totalTokens.toLocaleString('en-US')}</strong>
                </div>
                <div>
                    <span className="detail-label">Input / cached</span>
                    <strong>
                        {conversation.inputTokens.toLocaleString('en-US')} /{' '}
                        {conversation.cachedInputTokens.toLocaleString('en-US')}
                    </strong>
                </div>
                <div>
                    <span className="detail-label">Output tokens</span>
                    <strong>{conversation.outputTokens.toLocaleString('en-US')}</strong>
                </div>
                <div>
                    <span className="detail-label">Estimated cost</span>
                    <strong>
                        {conversation.estimatedCostUsd === null
                            ? 'Unavailable'
                            : formatCurrency(conversation.estimatedCostUsd)}
                    </strong>
                </div>
                <div>
                    <span className="detail-label">Average TTFT</span>
                    <strong>{formatDuration(conversation.averageTtftMs)}</strong>
                </div>
                <div>
                    <span className="detail-label">Responses</span>
                    <strong>{conversation.completedResponses}</strong>
                </div>
            </div>
        </section>
    );
}

export function App() {
    const [connected, setConnected] = useState(false);
    const [range, setRange] = useState<TelemetryRange>('7d');
    const [model, setModel] = useState('all');
    const [overview, setOverview] = useState<TelemetryOverview | null>(null);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

    const loadOverview = useCallback(async () => {
        try {
            const response = await fetch(
                `/api/telemetry/overview?range=${range}&model=${encodeURIComponent(model)}`,
            );

            if (!response.ok) {
                throw new Error('Unable to load telemetry overview');
            }

            const nextOverview = (await response.json()) as TelemetryOverview;
            setOverview(nextOverview);
            setConnected(true);
        } catch {
            setConnected(false);
        }
    }, [model, range]);

    useEffect(() => {
        void loadOverview();
        const intervalId = window.setInterval(() => void loadOverview(), 5_000);

        return () => window.clearInterval(intervalId);
    }, [loadOverview]);

    useEffect(() => {
        const firstConversation = overview?.conversations[0];

        if (
            selectedConversationId === null ||
            !overview?.conversations.some(({ id }) => id === selectedConversationId)
        ) {
            setSelectedConversationId(firstConversation?.id ?? null);
        }
    }, [overview, selectedConversationId]);

    const selectedConversation = useMemo(
        () => overview?.conversations.find(({ id }) => id === selectedConversationId) ?? null,
        [overview, selectedConversationId],
    );
    const summary = overview?.summary;
    const availableModels = overview?.availableModels ?? [];

    return (
        <div className="app-shell">
            <Sidebar
                connected={connected}
                conversations={overview?.conversations ?? []}
                selectedConversationId={selectedConversationId}
                onSelectConversation={setSelectedConversationId}
            />
            <main className="main-content">
                <header className="page-header">
                    <div>
                        <p className="eyebrow">Global overview</p>
                        <h1>Codex usage</h1>
                        <p className="page-header__description">
                            A global view of your Codex activity on this machine.
                        </p>
                    </div>
                    <div className="live-pill">
                        <span
                            className={`connection-dot ${connected ? 'connection-dot--live' : ''}`}
                        />
                        {connected ? 'Live updates' : 'Waiting for telemetry'}
                    </div>
                </header>

                <section className="filter-bar" aria-label="Overview filters">
                    <div className="filter-group">
                        <span className="detail-label">Time window</span>
                        <div className="range-tabs" role="group" aria-label="Time window">
                            {rangeOptions.map((option) => (
                                <button
                                    className={range === option.value ? 'range-tab--active' : ''}
                                    key={option.value}
                                    type="button"
                                    onClick={() => setRange(option.value)}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <label className="filter-group filter-group--model">
                        <span className="detail-label">Model</span>
                        <select
                            className="filter-select"
                            value={model}
                            onChange={(event) => setModel(event.target.value)}
                        >
                            <option value="all">All models</option>
                            {availableModels.map((availableModel) => (
                                <option key={availableModel} value={availableModel}>
                                    {availableModel}
                                </option>
                            ))}
                        </select>
                    </label>
                </section>

                <section className="stats-grid" aria-label="Usage summary">
                    <StatCard label="Total tokens" value={summary?.totalTokens ?? 0} icon="✦" />
                    <StatCard
                        label="Estimated cost"
                        value={summary?.estimatedCostUsd ?? null}
                        icon="$"
                        format={formatCurrency}
                    />
                    <StatCard
                        label="Conversations"
                        value={summary?.conversationCount ?? 0}
                        icon="◎"
                    />
                    <StatCard
                        label="Average TTFT"
                        value={summary?.averageTtftMs ?? 0}
                        suffix="ms"
                        icon="↗"
                        format={formatMilliseconds}
                    />
                </section>

                <section className="content-card chart-card">
                    <div className="section-heading">
                        <div>
                            <p className="eyebrow">Usage trend</p>
                            <h2>Token activity</h2>
                        </div>
                        <span className="muted-label">
                            {overview?.trend.some((point) => point.totalTokens > 0)
                                ? `${range} window`
                                : 'No events yet'}
                        </span>
                    </div>
                    {overview ? <UsageChart points={overview.trend} /> : <EmptyChart />}
                </section>

                <ConversationDetail conversation={selectedConversation} />
            </main>
        </div>
    );
}
