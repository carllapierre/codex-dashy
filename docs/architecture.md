# Architecture

Codex Dashy has three runtime pieces and a layered API. The bridge is a host-side adapter, not part of the Docker image.

```text
Codex CLI / app
    │
    ├── OTLP/HTTP JSON logs ───────────────► API :8789/v1/logs ──► SQLite
    │
    └── Codex App Server ◄── host bridge :8790
                                      ▲
                                      │
                         API /api/codex/usage
                                      ▲
                                      │
                              React dashboard
```

## Host bridge

`tools/codex-usage-bridge.ts` starts `codex app-server --stdio`, initializes the JSON-RPC session, and requests authenticated rate-limit and account-usage data. It listens for rate-limit updates, keeps a normalized snapshot in memory, and exposes it at `GET /snapshot` on loopback.

The bridge does not read or persist auth tokens. It relies on Codex App Server to use the existing local Codex authentication. If the child process exits, the bridge retries it. If the bridge itself is not running, the API returns an explicit unavailable usage snapshot and the rest of the dashboard continues to function.

## API layers

The API follows the project boundaries defined in `AGENTS.md`:

- `domain` contains telemetry and Codex usage types.
- `application` contains use cases such as ingesting logs and reading usage.
- `infrastructure` contains SQLite, environment loading, and the bridge client.
- `interface/http` contains route registration, controllers, and HTTP mapping.

Routes stay thin. Controllers translate HTTP requests and responses, while use cases coordinate domain behavior and infrastructure ports.

## Frontend

The React app owns view state for the overview, conversations, model filters, time windows, and usage limits. Reusable components live under `apps/web/src/components`; feature-level behavior stays in `App.tsx` and the telemetry feature types. The overview polls the API every five seconds so new telemetry and bridge snapshots become visible without a manual refresh. Accepted OTLP batches send an activity pulse to the bridge; the bridge refreshes immediately and every 10 seconds while activity continues, then stops after 10 seconds of silence. Push notifications are applied immediately as well.

## Persistence

SQLite keeps sanitized OTLP batches as the raw archive, while indexed projection tables hold hourly usage buckets, conversation summaries, prompt timelines, and per-conversation usage buckets. Overview reads use only those projections; conversation detail loads its prompt chain separately through `GET /api/telemetry/conversations/:id`.

The projection migration backfills existing raw batches in small, idempotent transactions. A projection marker is written with each converted batch, so an interrupted startup resumes from the remaining batches and duplicate ingestion cannot double-count usage. Raw credentials and authorization headers are not persisted. Estimated cost is calculated from the stored editable model-rate table and is not subscription billing.
