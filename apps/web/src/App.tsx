import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyChart } from './components/empty-chart';
import { CodexUsageLimits } from './components/codex-usage-limits';
import { ModelRatesPage } from './components/model-rates-page';
import { Sidebar } from './components/sidebar';
import { UsageChart } from './components/usage-chart';
import { StatCard } from './components/ui/stat-card';
import { MarkdownContent } from './components/ui/markdown-content';
import type {
    TelemetryConversation,
    CodexUsageSnapshot,
    TelemetryOverview,
    TelemetryRange,
} from './features/telemetry/telemetry.types';

const rangeOptions: Array<{ value: TelemetryRange; label: string }> = [
    { value: '1d', label: '1 day' },
    { value: '7d', label: '1 week' },
    { value: '30d', label: '1 month' },
];

type DashboardView = 'overview' | 'conversation' | 'settings';

const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 4,
});
const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

function formatCurrency(value: number): string {
    return currencyFormatter.format(value);
}

function formatMilliseconds(value: number): string {
    return Math.round(value).toLocaleString('en-US');
}

function getRangeLabel(range: TelemetryRange): string {
    return rangeOptions.find((option) => option.value === range)?.label ?? range;
}

function ConversationDetail({
    conversation,
    range,
    model,
}: {
    conversation: TelemetryConversation | null;
    range: TelemetryRange;
    model: string;
}) {
    const [promptExpanded, setPromptExpanded] = useState(false);

    useEffect(() => {
        setPromptExpanded(false);
    }, [conversation?.id]);

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

    const prompt = conversation.initialPrompt ?? 'Prompt unavailable';
    const canExpandPrompt = prompt.length > 320;
    const promptId = `conversation-prompt-${conversation.id}`;

    return (
        <section className="content-card conversation-detail" aria-label="Conversation details">
            <div className="section-heading">
                <div>
                    <p className="eyebrow">Conversation detail</p>
                    <h2>{conversation.model ?? 'Model unavailable'}</h2>
                </div>
                <div className="conversation-detail__metadata">
                    <span className="muted-label">
                        {getRangeLabel(range)} · {model === 'all' ? 'All models' : model}
                    </span>
                    <span className="muted-label">
                        Reasoning:{' '}
                        {conversation.reasoningEfforts.length > 0
                            ? conversation.reasoningEfforts.join(', ')
                            : 'Unavailable'}
                    </span>
                </div>
            </div>
            <div
                className={`conversation-detail__prompt ${
                    promptExpanded ? 'conversation-detail__prompt--expanded' : ''
                }`}
            >
                <span className="detail-label">Initial prompt</span>
                <MarkdownContent content={prompt} id={promptId} />
                {canExpandPrompt ? (
                    <button
                        className="conversation-detail__prompt-toggle"
                        type="button"
                        aria-controls={promptId}
                        aria-expanded={promptExpanded}
                        onClick={() => setPromptExpanded((expanded) => !expanded)}
                    >
                        {promptExpanded ? 'Collapse prompt' : 'Show full prompt'}
                        <span aria-hidden="true">{promptExpanded ? '↑' : '↓'}</span>
                    </button>
                ) : null}
            </div>
            <section
                className="stats-grid conversation-detail__stats"
                aria-label="Conversation summary"
            >
                <StatCard label="Total tokens" value={conversation.totalTokens} icon="✦" />
                <StatCard
                    label="Estimated cost"
                    value={conversation.estimatedCostUsd}
                    icon="$"
                    format={formatCurrency}
                />
                <StatCard
                    label="Average TTFT"
                    value={conversation.averageTtftMs}
                    suffix="ms"
                    icon="↗"
                    format={formatMilliseconds}
                />
                <StatCard label="Responses" value={conversation.completedResponses} icon="◎" />
            </section>
            <section
                className="conversation-detail__breakdown"
                aria-label="Conversation token breakdown"
            >
                <div>
                    <span className="detail-label">Input tokens</span>
                    <strong>{conversation.inputTokens.toLocaleString('en-US')}</strong>
                </div>
                <div>
                    <span className="detail-label">Cached input</span>
                    <strong>{conversation.cachedInputTokens.toLocaleString('en-US')}</strong>
                </div>
                <div>
                    <span className="detail-label">Output tokens</span>
                    <strong>{conversation.outputTokens.toLocaleString('en-US')}</strong>
                </div>
            </section>
        </section>
    );
}

export function App() {
    const [range, setRange] = useState<TelemetryRange>('7d');
    const [model, setModel] = useState('all');
    const [activeView, setActiveView] = useState<DashboardView>('overview');
    const [overview, setOverview] = useState<TelemetryOverview | null>(null);
    const [codexUsage, setCodexUsage] = useState<CodexUsageSnapshot | null>(null);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

    const loadOverview = useCallback(async () => {
        const [telemetryResult, codexUsageResult] = await Promise.allSettled([
            fetch(
                `/api/telemetry/overview?range=${range}&model=${encodeURIComponent(model)}&timezone=${encodeURIComponent(localTimeZone)}`,
            ),
            fetch('/api/codex/usage'),
        ]);

        if (telemetryResult.status === 'fulfilled' && telemetryResult.value.ok) {
            try {
                setOverview((await telemetryResult.value.json()) as TelemetryOverview);
            } catch {
                // Keep the last successful overview visible while the next poll retries.
            }
        }

        if (codexUsageResult.status === 'fulfilled' && codexUsageResult.value.ok) {
            try {
                setCodexUsage((await codexUsageResult.value.json()) as CodexUsageSnapshot);
            } catch {
                // Keep the last successful usage snapshot visible while the next poll retries.
            }
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
    const selectConversation = useCallback((conversationId: string) => {
        if (!conversationId) {
            return;
        }

        setSelectedConversationId(conversationId);
        setActiveView('conversation');
    }, []);
    const isOverview = activeView === 'overview';
    const isSettings = activeView === 'settings';

    return (
        <div className="app-shell">
            <Sidebar
                conversations={overview?.conversations ?? []}
                activeView={activeView}
                selectedConversationId={selectedConversationId}
                onSelectOverview={() => setActiveView('overview')}
                onSelectConversation={selectConversation}
                onSelectSettings={() => setActiveView('settings')}
            />
            <main className="main-content">
                <header className="page-header">
                    <div>
                        <h1>
                            {isOverview
                                ? 'Codex usage'
                                : isSettings
                                  ? 'Model rates'
                                  : 'Conversation usage'}
                        </h1>
                        <p className="page-header__description">
                            {isOverview
                                ? 'A global view of your Codex activity on this machine.'
                                : isSettings
                                  ? 'Configure the estimates used to calculate token spend.'
                                  : 'Inspect token usage for the selected conversation.'}
                        </p>
                    </div>
                </header>

                {!isSettings ? (
                    <section
                        className="filter-bar"
                        aria-label={`${isOverview ? 'Overview' : 'Conversation'} filters`}
                    >
                        <div className="filter-group">
                            <span className="detail-label">Time window</span>
                            <div className="range-tabs" role="group" aria-label="Time window">
                                {rangeOptions.map((option) => (
                                    <button
                                        className={
                                            range === option.value ? 'range-tab--active' : ''
                                        }
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
                ) : null}

                {isOverview ? (
                    <>
                        <section className="stats-grid" aria-label="Usage summary">
                            <StatCard
                                label="Total tokens"
                                value={summary?.totalTokens ?? 0}
                                icon="✦"
                            />
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

                        <section className="overview-visuals">
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
                            <CodexUsageLimits snapshot={codexUsage} />
                        </section>
                    </>
                ) : isSettings ? (
                    <ModelRatesPage onSaved={() => setActiveView('overview')} />
                ) : (
                    <ConversationDetail
                        conversation={selectedConversation}
                        range={range}
                        model={model}
                    />
                )}
            </main>
        </div>
    );
}
