import type { TelemetryConversation } from '../features/telemetry/telemetry.types';
import { formatCompactNumber } from './ui/animated-number';

type SidebarProps = {
    connected: boolean;
    conversations: TelemetryConversation[];
    selectedConversationId: string | null;
    onSelectConversation: (conversationId: string) => void;
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
    connected,
    conversations,
    selectedConversationId,
    onSelectConversation,
}: SidebarProps) {
    return (
        <aside className="sidebar">
            <div className="brand">
                <div className="brand__mark">C</div>
                <div>
                    <div className="brand__name">Codex Dashy</div>
                    <div className="brand__caption">local telemetry</div>
                </div>
            </div>

            <nav className="sidebar__nav" aria-label="Main navigation">
                <button className="nav-item nav-item--active" type="button">
                    <span aria-hidden="true">◈</span>
                    Overview
                </button>
                <button className="nav-item" type="button">
                    <span aria-hidden="true">▦</span>
                    Conversations
                    <span className="nav-item__count">{conversations.length}</span>
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

            <div className="sidebar__footer">
                <span className={`connection-dot ${connected ? 'connection-dot--live' : ''}`} />
                {connected ? 'API connected' : 'Waiting for API'}
            </div>
        </aside>
    );
}
