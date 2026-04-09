<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# UNCC 8-Second Story Movie Builder

**ITSC 8010 Group Project — Final README Draft (L23)**

> This document is the primary trust artifact for the project. It explains what the system does, how AI participated in every phase of development, what trust guarantees are claimed, what evidence supports those claims, and where limitations remain.

---

## Table of Contents

1. [System Description](#1-system-description)
2. [How AI Was Used](#2-how-ai-was-used)
3. [Trust Gates](#3-trust-gates)
4. [Incident Reports](#4-incident-reports)
5. [Limitations and Residual Risks](#5-limitations-and-residual-risks)
6. [Running the Project Locally](#6-running-the-project-locally)
7. [CI Pipeline](#7-ci-pipeline)

---

## 1. System Description

### Purpose

The UNCC 8-Second Story Movie Builder is a research prototype for evaluating how well humans can calibrate trust in AI-assisted creative production. It provides a structured, instrumented workflow for planning, generating, reviewing, and exporting short-form AI video content — while tracking every human and AI decision as auditable evidence.

The system is not primarily a production tool. It is an **evaluation instrument**: a controlled environment in which researchers can stress-test their own ability to correctly trust, distrust, and calibrate AI outputs.

### Scope

The system covers a single, end-to-end movie production pipeline:

| Phase | Description |
|---|---|
| **Plan** | Load or author a shot-by-shot project plan using Gemini. Preset evaluation scenarios are provided. |
| **Produce** | Generate individual video shots via the Veo API. Shots can be regenerated; all attempts are preserved (append-only). |
| **Validate** | Run AI self-review (Gemini) against frame samples. Review rubric scores four dimensions: Narrative, Visual, Continuity, Physics. |
| **Export** | Bundle the full project state — plans, attempts, rubrics, outcome codes, and calibration labels — into a JSON evidence artifact. |

### Main Components

| Component | Role |
|---|---|
| `App.tsx` | Single-page application managing all four phases and application state (localStorage-persisted). |
| `services/gemini.ts` | All calls to Gemini and Veo APIs: plan generation, shot suggestions, self-review, video generation. |
| `types.ts` | Shared type definitions. Defines the `Shot`, `GenerationAttempt`, `SelfReviewRubric`, `Outcome`, and `Project` schemas. |
| `contracts/` | 18 static CI contracts that auto-validate the codebase against documented trust claims at every push. |
| `scripts/run-contracts.mjs` | Contract runner. Executes all 18 contracts and surfaces failures. |
| `tests/` | Vitest unit tests (e.g., API key validation logic). |
| `e2e/` | Playwright smoke test confirming the app shell loads. |
| `.github/workflows/` | GitHub Actions CI: full gate on push/PR (`ci.yml`), weekly lightweight contract sweep (`app-contract.yml`). |

---

## 2. How AI Was Used

AI was present throughout every phase of this project's lifecycle. The table below distinguishes AI-generated artifacts from human-authored decisions.

### Requirements and Design (L3–L7)

| Artifact | Origin | Human Decision |
|---|---|---|
| Initial system proposal | Human-authored | Scope, purpose, evaluation framing were set by the team. |
| Requirements document (v1, v2) | AI-assisted (Gemini drafts) | Human reviewed and trimmed scope; trust hypotheses were human-framed. |
| Design v1 | AI-assisted document | Phase model (plan/produce/validate/export) was a human architectural decision. |
| Trust hypotheses inventory | Human-authored (Jan 28, 2026) | Hypotheses were derived by reading the actual code, not from AI output. |

### Implementation (L8–L15)

| Artifact | Origin | Human Decision |
|---|---|---|
| `App.tsx` core phase logic | AI-assisted (Gemini/Codex) | Shot locking, append-only lineage, acceptance gate were explicitly requested by the team. |
| `services/gemini.ts` | AI-generated with human review | API key validation, timeout enforcement, and JSON parse safety were human-directed requirements. |
| Trust gate contracts 01–09 | AI-assisted (Codex) | The *mapping* of each contract to a trust claim was human-authored. |
| Trust gate contracts 10–18 | AI-assisted | Contract specifications were driven by gap analysis in the trust hypotheses document. |
| Vitest unit tests | AI-generated | Test scope was reviewed; the `validateApiKeyLogic` test was written to expose a gap in coverage. |
| Playwright smoke test | AI-generated | Human decision to test the app shell load as the E2E baseline. |

### Evaluation and Research (L18–L22)

| Artifact | Origin | Human Decision |
|---|---|---|
| Fault injection script (`inject-fault.mjs`) | AI-assisted | Human chose *which* gate to stress (Contract 06 — API Key). |
| FLAG incident log entries | Human-authored | All observations and calibration labels are human judgments. |
| PROGRESS.md, CONTRACTS.md | Human-authored summaries | Synthesized from team understanding, not AI output. |

**Key distinction:** AI generated code, tests, and draft documents throughout the project. Humans made all scoping, trust-framing, and architectural decisions. The system is specifically designed so that AI influence is traceable — every generation attempt is preserved with its full lineage in the exported evidence bundle.

---

## 3. Trust Gates

18 CI contracts enforce trust claims automatically at every push. All 18 passed as of the final baseline run (2026-04-02).

| # | Contract | Trust Claim | Maps To | Assumption |
|---|---|---|---|---|
| 01 | Plan Presets | Evaluation scenarios exist and are loadable | Preset loader in plan phase | `App.tsx` contains all required script names |
| 02 | Phases | All four workflow phases are present | Phase model (Design v1) | `App.tsx` has `plan`, `produce`, `validate`, `export` |
| 03 | Types / Lineage | Attempt lineage schema is intact | FR7 (Attempt Lineage) | `types.ts` defines `GenerationAttempt`, `parentAttemptId`, `attempts` |
| 04 | Attempts Append-Only | Regeneration never overwrites prior attempts | FR3, FR7 | Spread operator pattern in `App.tsx`; no slice/reset |
| 05 | Export Bundle | Full project exports as an evidence artifact | FR9 (Evidence Export) | `exportBundle()` serializes the complete project tree |
| 06 | API Key Validation | System fails fast before any AI call when key is missing | TR6 (Failure Surfacing) | `validateApiKey` is called at every AI entry point |
| 07 | Safe JSON Parse | All `JSON.parse` calls are wrapped; failures surface, never silently return `{}` | Safe parse gate | No bare `return JSON.parse(...)` patterns in `services/gemini.ts` |
| 08 | Video Generation Timeout | Veo polling never hangs indefinitely | TR7 | `generateVideoAttempt` enforces a max-wait deadline |
| 09 | Plan Structure Validation | Invalid plans are rejected before shot creation | H-S2 schema drift detection | App checks required fields (`narrativeIntent`, `videoPrompt`, `action`) |
| 10 | No Generate Without Acceptance | Video generation is blocked until the user explicitly accepts the plan | Human oversight gate | No generate path enabled without prior acceptance state |
| 11 | Project Context Persistence + Multimodal | Expanded project fields (`audioIntent`, `contentConstraints`, `referenceImages`) are initialized and hydrated safely | Backward-safe persistence | Hydration merges parsed data with defaults |
| 12 | Rubric Completeness | Rubrics from self-review are validated before use | Avoid treating `{}` as evidence | `validateRubric` or explicit field checks exist before rubric is stored |
| 13 | Evidence Export Completeness | Export includes shots, validation reviews, and outcomes | Evidence completeness | `JSON.stringify(project)` captures the full tree |
| 14 | Mandatory Outcome Coding Before Export | Export is gated or warned when outcomes are uncoded | Evidence integrity | Check for outcome coding state before export proceeds |
| 15 | Frame Sampling Quality | Frames are validated before self-review runs | Prevent corrupted evidence | `sampleFrames` validates length and dimensions |
| 16 | Error Classification | Errors use structured taxonomy (`FailureType`, `FailureVisibility`) | TR6 / Trust analysis | `types.ts` defines the error taxonomy |
| 17 | Trust Calibration Guidance | Outcome UI provides guidance for Under-trust / Calibrated / Over-trust labels | H-H2 (Calibration Stability) | `trustCalibration` field and guidance copy exist in the outcome UI |
| 18 | Continuity Metadata Honesty | `useSeed`/`useRefImage` in metadata matches what is actually sent to Veo | Metadata honesty | Either options are forwarded to the API, or the gap is documented |

### How Contracts Are Enforced

Contracts run in two modes:

- **On every push/PR** via `.github/workflows/ci.yml`: lint → unit tests → contracts → E2E (Playwright).
- **Weekly** via `.github/workflows/app-contract.yml`: unit tests + contracts only (no browser); opens or closes a GitHub Issue automatically on failure.

Contracts are static code-analysis checks, not runtime tests. They cannot guarantee correctness at runtime — only that the structural conditions for correctness are present.

---

## 4. Incident Reports

Full incident log: [`docs/INCIDENTS.md`](docs/INCIDENTS.md)

### FLAG-20260330-01 — Scenario Addition (Script 4: Boca Cola Commercial)

- **Trust Gates Stressed:** Contract 09 (Plan Structure Validation), Contract 11 (Project Context Persistence)
- **Behavior:** A high-fidelity beverage commercial scenario was introduced to stress the AI's brand-safety and fluid-dynamics capabilities.
- **Gate Status:** PASSED — structural validation confirmed.
- **Lesson Learned:** The scenario exposed a real trust gap: without multimodal reference images, brand-color consistency across shots relies entirely on prompt phrasing, which is insufficient. This motivated the addition of the `referenceImages` field to the project schema (Contract 11).

### FLAG-20260402-01 — Baseline Verification + Fault Injection (L22)

- **Trust Gates Stressed:** Contract 06 (API Key Validation), Contract 14 (Export Gate), Contract 18 (Metadata Honesty)
- **Behavior:** All 18 contracts passed the baseline run. Fault injection then mutated the API key validation logic (`key.length < 10` → `key.length > 10`) to simulate a bypass attempt.
- **Gate Status:** CAUGHT — Contract 06 detected the injected fault and failed as expected.
- **Lesson Learned:** The CI contract suite is functioning as an effective "trust perimeter." Code-level bypasses of trust gates are detectable without requiring runtime execution. This validates the contract-based enforcement model.

---

## 5. Limitations and Residual Risks

These are stated plainly. They are not hedged.

### Unimplemented Hypotheses Still Present in the UI

The following hypotheses are reflected in the UI but are not actually implemented in the underlying service calls. This creates a misleading appearance of functionality:

| Hypothesis | What the UI Implies | What Actually Happens |
|---|---|---|
| H-G1: `useSeed` improves continuity | Seed option is available and labeled | `generateVideoAttempt` records `useSeed` in metadata but never forwards a seed value to Veo. |
| H-G2: `previousVideoUrl` stabilizes regeneration | Parameter exists in the function signature | The parameter is accepted but never used. Any study of continuity via this mechanism is currently impossible. |
| H-G3: Explanations improve future prompts | `requestExplanation` flag is sent | Explanations are concatenated into prompts but never parsed or stored. Cannot be inspected or evaluated. |

**Risk:** A researcher relying on the UI labels for these three features would draw false conclusions from the evidence bundle. Contract 18 (Continuity Metadata Honesty) documents this gap but does not close it.

### Evidence Fragility

- **localStorage only.** The entire project state — all attempts, rubrics, outcome codes, and research observations — is stored in the browser's `localStorage`. Clearing the cache, switching browsers, or losing the device **permanently destroys all evidence**. There is no backend persistence and no export reminder enforced at session end.
- **No API request/response logging.** The exported evidence bundle does not include raw API request bodies, response payloads, or generation error details. This means the bundle can show that a rubric was stored without proving that the rubric was actually generated by the AI rather than being a malformed or cached response.

### Contract Scope Limitations

Contracts are static code checks. They cannot detect:
- Runtime failures where the correct code path is present but produces incorrect outputs.
- Cases where an AI-generated response passes the schema check but is semantically wrong (e.g., a rubric that gives a high Continuity score to a shot that obviously drifts).
- Session-level behaviors such as whether a user actually reviewed a rubric before accepting it.

### Trust Calibration Subjectivity

The Under-trust / Calibrated / Over-trust labels in the outcome UI are self-reported. Contract 17 enforces that guidance exists, but there is no mechanism to validate whether users are applying the taxonomy consistently across sessions or in alignment with any external ground truth.

---

## 6. Running the Project Locally

**Prerequisites:** Node.js

```bash
npm install
```

Set `GEMINI_API_KEY` in `.env.local`:

```
GEMINI_API_KEY=your_key_here
```

Start the dev server:

```bash
npm run dev
# Opens at http://127.0.0.1:3000
```

---

## 7. CI Pipeline

| Command | What it runs |
|---|---|
| `npm run lint` | `tsc --noEmit` — TypeScript strict check |
| `npm run test` | Vitest unit tests (`tests/`) |
| `npm run contracts` | All 18 CI contracts (`scripts/run-contracts.mjs`) |
| `npm run test:e2e` | Playwright smoke test — app shell loads (`e2e/`) |
| `npm run test:fault-inject` | Fault injection run (`scripts/inject-fault.mjs`) |

For first-time E2E: `npx playwright install chromium`

Full CI and contract sweep documentation: [`docs/dylan/ci-and-e2e-session.md`](docs/dylan/ci-and-e2e-session.md)

---

*Draft committed for ITSC 8010 L23 — Final README Draft (Apr. 7, 2026). See [`docs/PROGRESS.md`](docs/PROGRESS.md) for project phase history and [`docs/CONTRACTS.md`](docs/CONTRACTS.md) for full contract specifications.*
