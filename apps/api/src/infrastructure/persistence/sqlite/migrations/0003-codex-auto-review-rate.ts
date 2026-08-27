import { DEFAULT_MODEL_RATES } from '../../../telemetry/model-rate-defaults';
import type { SqliteMigration } from './types';

export const codexAutoReviewRateMigration: SqliteMigration = {
    version: '0003_codex_auto_review_rate',
    name: 'codex-auto-review-rate',
    up(database) {
        const rate = DEFAULT_MODEL_RATES['codex-auto-review'];

        if (!rate) {
            throw new Error('Missing default rate for codex-auto-review');
        }

        database
            .prepare(
                `
                INSERT OR IGNORE INTO model_rates (
                    model,
                    input_per_million_usd,
                    cached_input_per_million_usd,
                    output_per_million_usd,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?)
            `,
            )
            .run(
                'codex-auto-review',
                rate.inputPerMillionUsd,
                rate.cachedInputPerMillionUsd,
                rate.outputPerMillionUsd,
                new Date().toISOString(),
            );
    },
};
