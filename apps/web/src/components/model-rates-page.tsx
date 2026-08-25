import { useEffect, useState } from 'react';
import type { ModelRate } from '../features/telemetry/telemetry.types';

type ModelRatesPageProps = {
    onSaved: () => void;
};

type RateField = 'inputPerMillionUsd' | 'cachedInputPerMillionUsd' | 'outputPerMillionUsd';

const rateFields: Array<{ key: RateField; label: string }> = [
    { key: 'inputPerMillionUsd', label: 'Input / 1M' },
    { key: 'cachedInputPerMillionUsd', label: 'Cached input / 1M' },
    { key: 'outputPerMillionUsd', label: 'Output / 1M' },
];

function formatRate(value: number): string {
    return String(value);
}

export function ModelRatesPage({ onSaved }: ModelRatesPageProps) {
    const [rates, setRates] = useState<ModelRate[]>([]);
    const [drafts, setDrafts] = useState<Record<string, Partial<Record<RateField, string>>>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function loadRates() {
            try {
                const response = await fetch('/api/settings/model-rates');

                if (!response.ok) {
                    throw new Error('Unable to load model rates');
                }

                const nextRates = (await response.json()) as ModelRate[];

                if (!cancelled) {
                    setRates(nextRates);
                    setDrafts(
                        Object.fromEntries(
                            nextRates.map((rate) => [
                                rate.model,
                                {
                                    inputPerMillionUsd: formatRate(rate.inputPerMillionUsd),
                                    cachedInputPerMillionUsd: formatRate(
                                        rate.cachedInputPerMillionUsd,
                                    ),
                                    outputPerMillionUsd: formatRate(rate.outputPerMillionUsd),
                                },
                            ]),
                        ),
                    );
                }
            } catch {
                if (!cancelled) {
                    setError('Unable to load model rates.');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void loadRates();

        return () => {
            cancelled = true;
        };
    }, []);

    function updateDraft(model: string, field: RateField, value: string) {
        setDrafts((current) => ({
            ...current,
            [model]: {
                ...current[model],
                [field]: value,
            },
        }));
    }

    async function saveRates() {
        setSaving(true);
        setError(null);

        try {
            const updates = rates.map(async (rate) => {
                const draft = drafts[rate.model];
                const values = Object.fromEntries(
                    rateFields.map(({ key }) => [key, Number(draft?.[key])]),
                );
                const response = await fetch(
                    `/api/settings/model-rates/${encodeURIComponent(rate.model)}`,
                    {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(values),
                    },
                );

                if (!response.ok) {
                    throw new Error('Unable to save model rates');
                }

                return (await response.json()) as ModelRate;
            });
            const updatedRates = await Promise.all(updates);

            setRates(updatedRates);
            onSaved();
        } catch {
            setError('Unable to save model rates. Check that every value is non-negative.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="content-card model-rates-page" aria-labelledby="model-rates-title">
            <div className="model-rates-page__header">
                <div>
                    <p className="eyebrow">Configuration</p>
                    <h2 id="model-rates-title">Model rates</h2>
                    <p className="model-rates-page__description">
                        Configure estimated USD rates per million tokens. These do not represent
                        subscription billing.
                    </p>
                </div>
            </div>

            {loading ? <p className="model-rates-message">Loading model rates…</p> : null}
            {error ? (
                <p className="model-rates-message model-rates-message--error">{error}</p>
            ) : null}
            {!loading && rates.length > 0 ? (
                <div className="model-rates-table" role="table" aria-label="Model rates">
                    <div
                        className="model-rates-table__row model-rates-table__row--header"
                        role="row"
                    >
                        <span role="columnheader">Model</span>
                        {rateFields.map(({ key, label }) => (
                            <span key={key} role="columnheader">
                                {label}
                            </span>
                        ))}
                    </div>
                    {rates.map((rate) => (
                        <div className="model-rates-table__row" key={rate.model} role="row">
                            <strong role="cell">{rate.model}</strong>
                            {rateFields.map(({ key, label }) => (
                                <label key={key} role="cell">
                                    <span className="sr-only">
                                        {rate.model} {label}
                                    </span>
                                    <input
                                        aria-label={`${rate.model} ${label}`}
                                        min="0"
                                        step="any"
                                        type="number"
                                        value={drafts[rate.model]?.[key] ?? ''}
                                        onChange={(event) =>
                                            updateDraft(rate.model, key, event.target.value)
                                        }
                                    />
                                </label>
                            ))}
                        </div>
                    ))}
                </div>
            ) : null}

            <div className="model-rates-page__actions">
                <button
                    className="button button--accent"
                    disabled={loading || saving || rates.length === 0}
                    type="button"
                    onClick={() => void saveRates()}
                >
                    {saving ? 'Saving…' : 'Save rates'}
                </button>
            </div>
        </section>
    );
}
