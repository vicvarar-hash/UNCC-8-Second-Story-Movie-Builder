# L15 Test Gate Stress — Session Summary

**Date:** 2026-03-03

## What We Implemented

L15 "Test Gate Stress" (preliminary): unit tests, fault injection, and CI integration. Tests live in the **infra repo**; the app repo stays minimal.

---

## Tests

**File:** `tests/apiKeyValidation.test.ts`

| Test | What it checks |
|------|----------------|
| Throws when key empty | `validateApiKeyLogic("")` throws |
| Throws when key too short | `validateApiKeyLogic("short")`, `validateApiKeyLogic("123456789")` throw |
| Does not throw when valid | `validateApiKeyLogic("1234567890")` and longer keys do not throw |

---

## Changes by Repo

### Infra (`UNCC-8-Second-Story-Movie-Builder-infra`)
- `package.json` — Vitest, `npm run test`, `npm run test:fault-inject`
- `tests/apiKeyValidation.test.ts` — 3 tests for `validateApiKeyLogic`
- `scripts/inject-fault.mjs` — Mutates `key.length < 10` → `key.length > 10`, runs tests, restores
- `vitest.config.ts` — Path alias `app` → `APP_DIR` or `./app`
- `.gitignore` — `node_modules`, `app/`
- `.github/workflows/app-contract.yml` — Runs unit tests before contracts
- `docs/CONTRACTS.md` — Note about tests

### App (`UNCC-8-Second-Story-Movie-Builder`)
- `services/gemini.ts` — Exported `validateApiKeyLogic(key)` (pure validation)
- Docker dev setup — `Dockerfile`, `docker-compose.yml`, `.dockerignore`
- Removed — `__tests__/`, test scripts, Vitest, `test-gate-stress.yml`

### Artifacts
- `docs/HOW_TO_VALIDATE.md` — How to run tests and fault injection from infra
- `docs/TEST_ASSUMPTIONS.md` — What the API key tests assume
- `docs/INCIDENTS.md` — Template for fault-injection outcomes

---

## How to Run

From infra repo (with app at `./app` or via junction):

```bash
npm run test              # Unit tests
npm run test:fault-inject # Fault injection (expect tests to fail)
```

---

## L15 Alignment

| Requirement | Implementation |
|-------------|----------------|
| Generate tests | Hand-written; assumptions in Artifacts `TEST_ASSUMPTIONS.md` |
| Inject faults | `scripts/inject-fault.mjs` |
| Analyze / document | Artifacts `INCIDENTS.md` |
| Refine gates | Documented in validation workflow |
| Actions | Infra workflow runs tests + contracts |
