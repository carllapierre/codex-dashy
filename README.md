# Codex Dashy

Codex Dashy is a local-first dashboard for inspecting Codex telemetry. This pass creates the runnable application frame only; OTEL ingestion and dashboard data will be added next.

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

Change the host port without changing the internal API port:

```bash
HOST_PORT=8790 docker compose up --build -d
```

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

## Planned next pass

The next pass will add OTLP/HTTP ingestion, event normalization, token aggregation, estimated-cost configuration, project/session grouping, live updates, and animated data visualizations. Until then, the UI intentionally shows zero and empty states rather than placeholder telemetry.
