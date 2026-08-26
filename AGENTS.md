# Codex Dashy contributor guidance

This is a small proof of concept, but it should remain easy to extend. Prefer clear boundaries and boring, explicit code over clever abstractions.

## Project structure

- `apps/api/src/domain`: business concepts and domain types. This layer does not know about Fastify or SQLite.
- `apps/api/src/application`: use cases and application services.
- `apps/api/src/infrastructure`: environment loading, SQLite, migrations, and external adapters.
- `apps/api/src/interface/http`: routes, controllers, request/response mapping, and HTTP concerns.
- `apps/web/src/components`: reusable React components.
- `apps/web/src/features`: feature-level screens and state.

## API rules

- Keep route registration thin.
- Put request handling in controllers.
- Put application behavior in use cases.
- Keep persistence behind infrastructure adapters.
- Do not let database types leak into the domain layer.

## Frontend rules

- Use plain CSS and reusable component classes. Tailwind is intentionally not used.
- Treat `apps/web/src/styles/tokens.css` as the design-system source of truth for palette, typography, spacing, shape, elevation, and motion.
- Before creating feature-specific UI, check whether the pattern can be expressed as a reusable generic component. Prefer small, semantic primitives with content or behavior supplied through props over duplicated markup and one-off styles.
- Use semantic tokens in component styles; add a new primitive only when an existing token cannot express the intended design.
- Prefer component-level semantic classes over one-off inline styles or arbitrary values.
- Keep dark-theme and reduced-motion behavior centralized in the token layer.
- Keep UI components presentational where practical.
- Do not invent telemetry values. Empty states must represent missing data as zero, unavailable, or pending.
- Animations may interpolate between real previous and current values only.

## Code style

- TypeScript is strict.
- Use four spaces, never tabs.
- Use single quotes and semicolons.
- Run `npm run lint`, `npm run typecheck`, and `npm run format:check` before handoff.
- Add or update README documentation when setup or behavior changes.

## Commit conventions

- Use Conventional Commits for every commit.
- Format commit messages as `type(scope): description`, for example `feat(telemetry): add OTLP log ingestion`.
- Use lowercase types such as `feat`, `fix`, `test`, `refactor`, `docs`, `build`, `chore`, or `ci`.
- Keep each commit focused on one coherent change.
- Write the subject in the imperative mood, keep it concise, and do not end it with a period.
- Use a commit body when context, migration notes, or breaking behavior needs explanation.
- Mark breaking changes with `!` after the type or scope and explain them in the footer, for example `feat(api)!: replace the events endpoint`.

## Testing guidance

- Add tests for core behavior and user-visible outcomes, not every line or implementation detail.
- Prefer a small number of high-value tests: domain/application rules, API contract behavior, and important UI states.
- Do not add tests solely to increase coverage or mirror private helper structure.
- Keep tests deterministic: use fixed clocks, temporary databases, sanitized fixtures, and real values only.
- Test empty, success, duplicate, malformed, and unavailable-data states where they affect behavior.
- Use Vitest for API/application and component tests, Testing Library for React behavior, and Playwright only for a few end-to-end smoke paths.
- After implementing changes, run `npm run verify`. Run `npm run test:e2e` when changing the browser-to-API workflow, Docker serving, routing, or live updates.
- When a test fails, fix the behavior or update the test with the same care; do not disable it to get a green suite.

## Telemetry privacy

Telemetry will be local-only by default. Treat raw prompts and event payloads as sensitive. Avoid persisting credentials, account identifiers, or authorization headers unless explicitly requested.
