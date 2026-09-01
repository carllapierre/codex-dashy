import { codexAutoReviewRateMigration } from './0003-codex-auto-review-rate';
import { initialMigration } from './0001-initial';
import { modelRatesMigration } from './0002-model-rates';
import { telemetryProjectionsMigration } from './0004-telemetry-projections';
import type { SqliteMigration } from './types';

export const migrations: readonly SqliteMigration[] = [
    initialMigration,
    modelRatesMigration,
    codexAutoReviewRateMigration,
    telemetryProjectionsMigration,
];
