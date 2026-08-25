import type { TelemetryConversation } from '../features/telemetry/telemetry.types';
import { formatCompactNumber } from './ui/animated-number';

type SidebarProps = {
    conversations: TelemetryConversation[];
    activeView: 'overview' | 'conversation' | 'settings';
    selectedConversationId: string | null;
    onSelectOverview: () => void;
    onSelectConversation: (conversationId: string) => void;
    onSelectSettings: () => void;
};

function formatRelativeDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? 'Unknown time'
        : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date);
}

function getPromptLabel(conversation: TelemetryConversation): string {
    return conversation.initialPrompt?.trim() || 'Prompt unavailable';
}

export function Sidebar({
    conversations,
    activeView,
    selectedConversationId,
    onSelectOverview,
    onSelectConversation,
    onSelectSettings,
}: SidebarProps) {
    return (
        <aside className="sidebar">
            <div className="brand">
                <div className="brand__mark" aria-hidden="true">
                    <svg className="brand__icon" viewBox="0 0 48 48" role="presentation">
                        <path
                            d="m10 14 8 8-8 8"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="4"
                        />
                        <path
                            d="M25 30h13"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeWidth="4"
                        />
                    </svg>
                </div>
                <div>
                    <div className="brand__name">Codex Dashy</div>
                    <div className="brand__caption">local telemetry</div>
                </div>
            </div>

            <nav className="sidebar__nav" aria-label="Main navigation">
                <button
                    className={`nav-item ${activeView === 'overview' ? 'nav-item--active' : ''}`}
                    type="button"
                    onClick={onSelectOverview}
                >
                    <svg className="nav-item__icon" viewBox="0 0 20 20" aria-hidden="true">
                        <path d="m10 2.5 7.5 7.5-7.5 7.5L2.5 10 10 2.5Z" />
                    </svg>
                    Overview
                </button>
                <button
                    className={`nav-item ${activeView === 'conversation' ? 'nav-item--active' : ''}`}
                    type="button"
                    onClick={() => onSelectConversation(conversations[0]?.id ?? '')}
                    disabled={conversations.length === 0}
                >
                    <svg className="nav-item__icon" viewBox="0 0 20 20" aria-hidden="true">
                        <rect x="3.5" y="3.5" width="13" height="13" rx="1.5" />
                        <path d="M3.5 8.5h13M8.5 3.5v13" />
                    </svg>
                    Conversations
                    <span className="nav-item__count">{conversations.length}</span>
                </button>
                <button
                    className={`nav-item ${activeView === 'settings' ? 'nav-item--active' : ''}`}
                    type="button"
                    onClick={onSelectSettings}
                >
                    <svg className="nav-item__icon" viewBox="0 0 20 20" aria-hidden="true">
                        <circle cx="10" cy="10" r="2.5" />
                        <path d="M10 2.75v2M10 15.25v2M2.75 10h2M15.25 10h2M4.87 4.87l1.42 1.42M13.71 13.71l1.42 1.42M15.13 4.87l-1.42 1.42M6.29 13.71l-1.42 1.42" />
                    </svg>
                    Model rates
                </button>
            </nav>

            <section className="sidebar__conversations" aria-label="Conversations">
                <div className="sidebar__section-heading">
                    <span>Recent conversations</span>
                    <span>{conversations.length}</span>
                </div>
                {conversations.length > 0 ? (
                    <div className="conversation-list">
                        {conversations.map((conversation) => (
                            <button
                                className={`conversation-item ${
                                    activeView === 'conversation' &&
                                    selectedConversationId === conversation.id
                                        ? 'conversation-item--active'
                                        : ''
                                }`}
                                key={conversation.id}
                                type="button"
                                onClick={() => onSelectConversation(conversation.id)}
                            >
                                <span className="conversation-item__prompt">
                                    {getPromptLabel(conversation)}
                                </span>
                                <span className="conversation-item__meta">
                                    <span>{conversation.model ?? 'Model unavailable'}</span>
                                    <span>{formatRelativeDate(conversation.lastActivityAt)}</span>
                                </span>
                                <span className="conversation-item__tokens">
                                    {formatCompactNumber(conversation.totalTokens)} tokens
                                </span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className="sidebar__empty">
                        Conversations will appear as telemetry arrives.
                    </p>
                )}
            </section>
        </aside>
    );
}
