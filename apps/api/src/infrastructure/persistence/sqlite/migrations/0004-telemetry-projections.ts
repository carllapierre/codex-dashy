import type Database from 'better-sqlite3';
import type { SqliteMigration } from './types';

export const telemetryProjectionsMigration: SqliteMigration = {
    version: '0004_telemetry_projections',
    name: 'Add telemetry projections',
    up: (database: Database.Database): void => {
        database.exec(`
            CREATE TABLE IF NOT EXISTS usage_buckets (
                bucket_start TEXT NOT NULL,
                model TEXT NOT NULL,
                input_tokens INTEGER NOT NULL DEFAULT 0,
                cached_input_tokens INTEGER NOT NULL DEFAULT 0,
                output_tokens INTEGER NOT NULL DEFAULT 0,
                reasoning_tokens INTEGER NOT NULL DEFAULT 0,
                tool_tokens INTEGER NOT NULL DEFAULT 0,
                completed_responses INTEGER NOT NULL DEFAULT 0,
                ttft_total_ms REAL NOT NULL DEFAULT 0,
                ttft_count INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (bucket_start, model)
            );

            CREATE INDEX IF NOT EXISTS idx_usage_buckets_start_model
                ON usage_buckets (bucket_start, model);

            CREATE TABLE IF NOT EXISTS conversation_summaries (
                conversation_id TEXT PRIMARY KEY,
                started_at TEXT NOT NULL,
                last_activity_at TEXT NOT NULL,
                model TEXT,
                initial_prompt TEXT,
                reasoning_efforts_json TEXT NOT NULL DEFAULT '[]'
            );

            CREATE INDEX IF NOT EXISTS idx_conversation_summaries_activity_model
                ON conversation_summaries (last_activity_at, model);

            CREATE TABLE IF NOT EXISTS conversation_prompts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id TEXT NOT NULL,
                observed_at TEXT NOT NULL,
                model TEXT,
                text TEXT NOT NULL,
                character_count INTEGER NOT NULL,
                UNIQUE (conversation_id, observed_at, text)
            );

            CREATE INDEX IF NOT EXISTS idx_conversation_prompts_conversation_time
                ON conversation_prompts (conversation_id, observed_at);

            CREATE TABLE IF NOT EXISTS conversation_usage_buckets (
                conversation_id TEXT NOT NULL,
                bucket_start TEXT NOT NULL,
                model TEXT NOT NULL,
                input_tokens INTEGER NOT NULL DEFAULT 0,
                cached_input_tokens INTEGER NOT NULL DEFAULT 0,
                output_tokens INTEGER NOT NULL DEFAULT 0,
                reasoning_tokens INTEGER NOT NULL DEFAULT 0,
                tool_tokens INTEGER NOT NULL DEFAULT 0,
                completed_responses INTEGER NOT NULL DEFAULT 0,
                ttft_total_ms REAL NOT NULL DEFAULT 0,
                ttft_count INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (conversation_id, bucket_start, model)
            );

            CREATE INDEX IF NOT EXISTS idx_conversation_usage_buckets_time_model
                ON conversation_usage_buckets (bucket_start, model);

            CREATE INDEX IF NOT EXISTS idx_conversation_usage_buckets_conversation_time
                ON conversation_usage_buckets (conversation_id, bucket_start);

            CREATE TABLE IF NOT EXISTS telemetry_projection_batches (
                batch_id INTEGER PRIMARY KEY,
                projected_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS telemetry_internal_conversations (
                conversation_id TEXT PRIMARY KEY,
                detected_at TEXT NOT NULL
            );
        `);
    },
};
