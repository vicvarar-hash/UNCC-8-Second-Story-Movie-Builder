# CI, E2E, and workflow hardening

**Branch:** `merged`  
**Context:** After infra integration and sync with `origin/main`, Playwright landed from `main`. This document records how tests and GitHub Actions were wired, then aligned with common CI practice.

---

## Local commands

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server (default **http://127.0.0.1:3000** per `vite.config.ts`) |
| `npm run build` / `npm run preview` | Production build and preview |
| `npm run lint` | `tsc --noEmit` |
| `npm run test` | Vitest (unit tests in `tests/`) |
| `npm run contracts` | Static contract suite (`scripts/run-contracts.mjs`) |
| `npm run test:e2e` | Playwright (`e2e/`); starts dev server via `playwright.config.ts` `webServer` |
| `npm run test:fault-inject` | L15 fault injection (`scripts/inject-fault.mjs`) |

**First-time E2E:** `npx playwright install chromium` (or `npx playwright install` for all browsers).

---

## Playwright + Vitest layout

- **`e2e/`** — Playwright specs only (e.g. `smoke.spec.ts`: app shell / title).
- **`tests/`** — Vitest only; `vitest.config.ts` uses `include: ["tests/**/*.test.ts"]` and `exclude: ["e2e/**"]` so runners do not cross-load files.
- **`playwright.config.ts`** — `testDir: ./e2e`, `baseURL` and `webServer` on port **3000** (matches Vite).
- **CI reporters:** When `CI` is set, Playwright uses `github` + `html` (for failure artifacts). Locally, `list` only.

**TypeScript:** `tests/apiKeyValidation.test.ts` imports `../services/gemini.ts` (relative path) so `npm run lint` resolves modules without a Vitest-only `app` alias in `tsconfig.json`.

---

## GitHub Actions (best-practice split)

### `CI` (`.github/workflows/ci.yml`)

- **Triggers:** `push` and `pull_request` to `main` and `merged`.
- **Steps:** `npm ci` → lint → unit tests → contracts → cache `~/.cache/ms-playwright` → `playwright install chromium --with-deps` → `npm run test:e2e`.
- **Concurrency:** `cancel-in-progress: true` per ref so redundant runs stop when you push again.
- **Failures:** Upload `playwright-report/` when possible (`if-no-files-found: ignore`).

### `Contract sweep` (`.github/workflows/app-contract.yml`)

- **Triggers:** `workflow_dispatch` and **weekly** schedule (`0 14 * * 1` — Monday 14:00 UTC). No push/PR (avoids duplicate work with `CI`).
- **Steps:** unit tests + contracts + existing issue open/update/close logic for contract failures.
- **No Playwright** — keeps scheduled minutes low; full browser gate runs only in `CI`.

**Rationale:** The previous **every-10-minutes** cron with full E2E was heavy and atypical; PR/push gating uses the full pipeline; drift monitoring stays on a **weekly** lightweight sweep.

---

## Related artifacts

- [`infra-integration-session.md`](infra-integration-session.md) — Infra merge into repo, sync with `main`, branch naming.
- [`contract-modification-session-3-5.md`](contract-modification-session-3-5.md) — Contracts 07–09 and 12–18 (from earlier work; also in this repo under `docs/dylan/`).

---

## Commits (reference)

Representative messages on `merged` (not exhaustive): infra integration, sync with `main`, Playwright config + smoke test, Vitest/Playwright isolation, `tsc` fix for tests, CI E2E on push, then **split** into `ci.yml` + weekly `Contract sweep`.
