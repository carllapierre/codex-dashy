# Telemetry

## Codex OTEL configuration

Add this to the user-level Codex configuration at `~/.codex/config.toml`:

```toml
[otel]
environment = "local"
log_user_prompt = true
exporter = { otlp-http = { endpoint = "http://127.0.0.1:8789/v1/logs", protocol = "json" } }
```

Restart Codex after changing the configuration. The API accepts OTLP/HTTP JSON at `/v1/logs`.

## Captured data

The dashboard uses the conversation ID, initial user prompt, observed model, token counts, response timing, tool activity, and completed responses. It does not infer project attribution from local session files.

The overview supports one-day, one-week, and one-month calendar windows based on the browser's local time zone, plus filtering by observed model. Internal Codex title-generation sessions are excluded from conversation counts and usage totals so they do not appear as duplicate user conversations.

## Usage limits

The host bridge uses the supported [Codex App Server](https://learn.chatgpt.com/docs/app-server) interface to read authenticated five-hour, weekly, and workspace allowance data when Codex provides it. Accepted OTLP batches trigger an immediate refresh, followed by refreshes every 10 seconds while telemetry activity continues. Polling stops after 10 seconds without a new batch, while rate-limit notifications are still applied immediately. The frontend displays an explicit unavailable state when the bridge cannot be reached; it never invents usage values.

## Estimated cost and model rates

Model rates are stored in SQLite and seeded from the current defaults on first run. Use **Model rates** in the dashboard sidebar to edit input, cached-input, and output prices in USD per million tokens. Existing edits survive restarts, and updating a rate recalculates displayed estimates without changing stored telemetry.

Estimated cost is an approximation based on those configured rates. It does not represent ChatGPT or Codex subscription billing.
