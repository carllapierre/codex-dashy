<p align="center">
    <img src="docs/codex-dashy-banner.svg" alt="Codex Dashy — local Codex telemetry dashboard" width="100%" />
</p>

Codex Dashy is a local-first dashboard for inspecting Codex telemetry. It receives local OTLP logs, stores sanitized batches in SQLite, and presents global usage alongside conversation-level token spend.

## Quick start

Configure Codex to send local telemetry by adding this to `~/.codex/config.toml`:

```toml
[otel]
environment = "local"
log_user_prompt = true
exporter = { otlp-http = { endpoint = "http://127.0.0.1:8789/v1/logs", protocol = "json" } }
```

Restart Codex after changing the configuration, then launch the Codex usage bridge, Docker dashboard, API, and local OTLP endpoint together:

```bash
npm run start:all
```

Open the dashboard at [http://localhost:8789](http://localhost:8789). Stop both processes with `Ctrl-C`.

## Stack

- TypeScript Node backend with Fastify
- React + Vite frontend
- SQLite persistence through `better-sqlite3`
- Plain CSS with reusable component classes; Tailwind is not used
- Docker Compose for always-on local execution

## Local development

```bash
npm install
npm run dev
```

The frontend runs at [http://localhost:5173](http://localhost:5173). The API health endpoint is [http://localhost:8789/api/health](http://localhost:8789/api/health).

## Docker

```bash
docker compose up --build -d
```

Open [http://localhost:8789](http://localhost:8789). SQLite data is persisted in `./data`.

The Docker port is bound to loopback by default so prompts and telemetry remain local to this machine.

Change the host port without changing the internal API port:

```bash
HOST_PORT=8790 docker compose up --build -d
```

## Codex account limits

Codex Dashy can also display authenticated ChatGPT/Codex usage limits through the supported [Codex App Server](https://learn.chatgpt.com/docs/app-server) interface. The bridge reuses Codex's existing local authentication and exposes only normalized usage data over a loopback-only HTTP endpoint; it does not read or persist auth tokens.

The equivalent two-terminal workflow is:

```bash
npm run codex:bridge
```

```bash
docker compose up --build -d
```

The Overview displays real rate-limit windows when Codex provides them, including the five-hour and weekly windows, plus workspace allowance details when available. It also requests account token-activity summaries. If the bridge is unavailable, the dashboard shows an explicit unavailable state instead of displaying fabricated values.

## Codex telemetry

The dashboard uses the captured conversation ID, initial user prompt, model, token counts, response timing, tool activity, and completed responses. It does not infer project attribution from local session files.

The overview supports 1-day, 1-week, and 1-month calendar windows based on the browser's local time zone, plus filtering by observed model. Internal Codex title-generation sessions are excluded from conversation counts and usage totals so they do not appear as duplicate user conversations. The conversation list updates every five seconds while the API is available. Estimated cost is based on the configured model rate table and should be treated as an estimate rather than subscription billing.

Model rates are stored in SQLite and seeded from the current defaults on first run. Use **Model rates** in the dashboard sidebar to edit input, cached-input, and output prices in USD per million tokens. Existing edits are preserved across restarts; updating a rate recalculates displayed estimates without changing stored telemetry.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run format:check
npm run build
```

The full local verification command is:

```bash
npm run verify
```

This runs linting, strict TypeScript checks, unit/component tests, formatting checks, and production builds. Browser smoke tests are separate:

```bash
npm run test:e2e
```

The test suite is intentionally small. It covers core application behavior, API contracts, important UI states, and a few end-to-end workflows without testing every implementation detail.
