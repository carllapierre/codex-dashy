# Stack

## Runtime components

- **API:** Strict TypeScript, Fastify, and `better-sqlite3`.
- **Frontend:** React, Vite, and plain CSS with reusable component classes. Tailwind is intentionally not used.
- **Host bridge:** A small TypeScript Node process that starts Codex App Server and exposes normalized usage data to the API.
- **Persistence:** SQLite in WAL mode, stored in `./data` for local Docker execution.
- **Container runtime:** Docker Compose runs the API, serves the built frontend, and persists SQLite data.

## Local development

Install dependencies and run the API and frontend development servers:

```bash
npm install
npm run dev
```

The frontend runs at [http://localhost:5173](http://localhost:5173). The API runs at [http://localhost:8789](http://localhost:8789).

For the full local workflow, including the authenticated Codex usage bridge, use:

```bash
npm run dev:all
```

Open [http://localhost:5173](http://localhost:5173) for the live Vite dashboard during development. Port `8789` is the development API and OTLP endpoint; its root page is only the last built frontend and is not hot-reloaded. The API and Vite frontend reload source changes without rebuilding Docker. If the bridge is already running, this command reuses it instead of starting a second copy. Stop the processes with `Ctrl-C`. Stop the production Docker container first if it is already using port `8789`.

## Docker

Build and run the dashboard in the background:

```bash
docker compose up --build -d
```

The dashboard is available at [http://localhost:8789](http://localhost:8789). The port is bound to loopback by default. To use a different host port:

```bash
HOST_PORT=8790 docker compose up --build -d
```

The host bridge must remain outside the container because it needs access to the local `codex` binary and its existing authentication. `docker-compose.yml` connects the API container to the host bridge through `host.docker.internal`.
