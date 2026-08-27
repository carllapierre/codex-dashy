import { DEFAULT_MODEL_RATES } from '../../../telemetry/model-rate-defaults';
import type { SqliteMigration } from './types';

export const modelRatesMigration: SqliteMigration = {
    version: '0002_model_rates',
    name: 'model-rates',
    up(database) {
        database.exec(`
            CREATE TABLE IF NOT EXISTS model_rates (
                model TEXT PRIMARY KEY,
                input_per_million_usd REAL NOT NULL CHECK (input_per_million_usd >= 0),
                cached_input_per_million_usd REAL NOT NULL CHECK (cached_input_per_million_usd >= 0),
                output_per_million_usd REAL NOT NULL CHECK (output_per_million_usd >= 0),
                updated_at TEXT NOT NULL
            );
        `);

        const seedRate = database.prepare(`
            INSERT OR IGNORE INTO model_rates (
                model,
                input_per_million_usd,
                cached_input_per_million_usd,
                output_per_million_usd,
                updated_at
            ) VALUES (?, ?, ?, ?, ?)
        `);
        const seededAt = new Date().toISOString();

        for (const [model, rate] of Object.entries(DEFAULT_MODEL_RATES)) {
            seedRate.run(
                model,
                rate.inputPerMillionUsd,
                rate.cachedInputPerMillionUsd,
                rate.outputPerMillionUsd,
                seededAt,
            );
        }
    },
};
