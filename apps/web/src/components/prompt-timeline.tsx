import { useState } from 'react';
import { MarkdownContent } from './ui/markdown-content';
import type { TelemetryPrompt } from '../features/telemetry/telemetry.types';

type PromptTimelineProps = {
    prompts: TelemetryPrompt[];
};

function formatPromptTime(value: string): string {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? 'Unknown time'
        : new Intl.DateTimeFormat('en', {
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              month: 'short',
          }).format(date);
}

export function PromptTimeline({ prompts }: PromptTimelineProps) {
    const [expandedPromptId, setExpandedPromptId] = useState<string | null>(null);

    if (prompts.length === 0) {
        return (
            <section className="prompt-timeline" aria-label="Conversation prompts">
                <div className="prompt-timeline__header">
                    <span className="detail-label">Prompts</span>
                    <span className="muted-label">Unavailable</span>
                </div>
                <p className="prompt-timeline__empty">No prompt text was captured.</p>
            </section>
        );
    }

    return (
        <section className="prompt-timeline" aria-label="Conversation prompts">
            <div className="prompt-timeline__header">
                <span className="detail-label">Prompts</span>
                <span className="muted-label">{prompts.length}</span>
            </div>
            <ol className="prompt-timeline__list">
                {prompts.map((prompt, index) => {
                    const isExpanded = expandedPromptId === prompt.id;
                    const promptContentId = `prompt-content-${prompt.id}`;
                    const label = index === 0 ? 'Initial prompt' : `Follow-up ${index}`;

                    return (
                        <li
                            className={`prompt-timeline__item ${
                                isExpanded ? 'prompt-timeline__item--expanded' : ''
                            }`}
                            key={prompt.id}
                        >
                            <button
                                className="prompt-timeline__row"
                                type="button"
                                aria-controls={promptContentId}
                                aria-expanded={isExpanded}
                                onClick={() =>
                                    setExpandedPromptId((currentId) =>
                                        currentId === prompt.id ? null : prompt.id,
                                    )
                                }
                            >
                                <span className="prompt-timeline__body">
                                    <span className="prompt-timeline__meta">
                                        <span>{label}</span>
                                        <span>
                                            {formatPromptTime(prompt.timestamp)} ·{' '}
                                            {prompt.model ?? 'Model unavailable'} ·{' '}
                                            {prompt.characterCount.toLocaleString('en-US')} chars
                                        </span>
                                    </span>
                                    {!isExpanded ? (
                                        <span className="prompt-timeline__preview">
                                            {prompt.text || 'Prompt unavailable'}
                                        </span>
                                    ) : null}
                                </span>
                                <span className="prompt-timeline__toggle" aria-hidden="true">
                                    {isExpanded ? '↑' : '↓'}
                                </span>
                            </button>
                            <div
                                className={`prompt-timeline__expansion ${
                                    isExpanded ? 'prompt-timeline__expansion--open' : ''
                                }`}
                                id={promptContentId}
                                role="region"
                                aria-hidden={!isExpanded}
                                aria-label={`${label} content`}
                            >
                                <div className="prompt-timeline__expanded-text">
                                    <MarkdownContent content={prompt.text} />
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}
