# Testing and quality checks

The test suite is intentionally small. It focuses on core application behavior, API contracts, important user-visible UI states, and a few browser smoke paths rather than mirroring every implementation detail.

## Verification

Run the full local verification command before handing off changes:

```bash
npm run verify
```

This runs:

- ESLint
- strict TypeScript checks
- API and application tests
- React component tests
- Prettier checks
- production builds

Browser smoke tests are separate:

```bash
npm run test:e2e
```

Run the E2E suite when changing browser-to-API behavior, Docker serving, routing, or live updates.

## Test guidance

- Test domain and application rules, API contracts, and important UI outcomes.
- Cover empty, success, duplicate, malformed, and unavailable states when they affect behavior.
- Keep tests deterministic with fixed clocks, temporary databases, sanitized fixtures, and real values.
- Use Vitest for API/application tests, Testing Library for React behavior, and Playwright for a small number of end-to-end smoke paths.
- Do not add tests solely to increase coverage or mirror private helper structure.
