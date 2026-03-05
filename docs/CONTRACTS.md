# CI Contracts — Trust Gate Traceability

Contracts live in `contracts/` and are run by `scripts/run-contracts.mjs`. Each contract exports a default async function that receives `ctx` and throws on failure.

**Unit tests** live in `tests/` and are run by `npm run test`. See Artifacts repo `docs/HOW_TO_VALIDATE.md` for validation workflow.

**Canonical source:** `AI Assisted Movie Production System Requirements Design and Trust Hypotheses.pdf`

---

## Contract 01: Plan Presets

**File:** `contracts/01_presets.mjs`

**What it checks:**
- `App.tsx` contains `phase === 'plan'`, "Load Preset Script"
- All three preset scripts: "Script 1: Continuity Drift", "Script 2: Plausible Planning Errors", "Script 3: Misleading Explanations"

**Maps to:** Plan stage and preset loader for evaluation scenarios

---

## Contract 02: Phases

**File:** `contracts/02_phases.mjs`

**What it checks:**
- App has phases: plan, produce, validate, export

**Maps to:** Phase model (Design v1)

---

## Contract 03: Types / Lineage

**File:** `contracts/03_types_lineage.mjs`

**What it checks:**
- `types.ts` has `parentAttemptId`, `acceptedAttemptId`, `attempts`, `GenerationAttempt`

**Maps to:** FR7 (Attempt Lineage), lineage preservation

---

## Contract 04: Attempts Append-Only

**File:** `contracts/04_attempts_append_only.mjs`

**What it checks:**
- Regeneration appends new attempts via spread (`[...s.attempts, newAttempt]`), does not overwrite

**Maps to:** FR3 (no overwrite), FR7 (lineage)

---

## Contract 05: Export Bundle

**File:** `contracts/05_export_bundle.mjs`

**What it checks:**
- App has `exportBundle` or evidence bundle export

**Maps to:** FR9 (Artifact Visibility, Evidence Export)

---

## Contract 06: API Key Validation (Trust Gate)

**File:** `contracts/06_api_key.mjs`

**What it checks:**
- `services/gemini.ts` has `validateApiKey` or `ensureApiKey`
- Throws with clear message when API key missing
- All AI entry points exist: `generateProjectPlan`, `suggestNextShotPlan`, `runAISelfReview`, `generateVideoAttempt`

**Maps to:**
- **TR6 (Failure Surfacing):** Fail fast before AI calls
- **Trust gate:** API Key Validation (Pre-Call)

---

## Contract 07: Safe JSON Parse with Error Surfacing

**File:** `contracts/07_safe_json_parse.mjs`

**What it checks:**
- `services/gemini.ts` wraps all `JSON.parse` in try-catch
- On parse failure, throws (never returns empty object silently)
- No bare `return JSON.parse(response.text || '{}')` pattern

**Maps to:** Trust gate — Safe JSON Parse with Error Surfacing (invalid rubrics/plans must not become `{}` with no visibility)

---

## Contract 08: Video Generation Timeout

**File:** `contracts/08_video_timeout.mjs`

**What it checks:**
- `generateVideoAttempt` enforces max wait time on the Veo polling loop
- Timeout logic present (TimeoutError, timeout constant, deadline, etc.)
- On timeout, surfaces error (prevents indefinite hangs)

**Maps to:** Trust gate — Video Generation Timeout (TR7)

---

## Contract 09: Plan Structure Validation

**File:** `contracts/09_plan_structure_validation.mjs`

**What it checks:**
- App validates plan structure before creating shots
- Either `validatePlan` / `validateShotPlan` function, or explicit checks for required fields (`narrativeIntent`, `videoPrompt`, `action`)
- Throws or surfaces error when validation fails (never silently proceed)

**Maps to:** Trust gate — Plan Structure Validation (H-S2, schema drift detection)

---

## Contract 10: No Generate Without Acceptance

**File:** `contracts/10_no_generate_without_acceptance.mjs`

**What it checks:**
- App blocks video generation until user explicitly accepts the plan
- No generate button enabled without acceptance

**Maps to:** Human oversight — explicit acceptance gate before AI generation

---

## Contract 11: Expanded Project Context Persistence + Multimodal Flow

**File:** `contracts/11_project_context_persistence_multimodal.mjs`

**What it checks:**
- `types.ts` Project schema includes: `audioIntent`, `contentConstraints`, `referenceImages`
- `App.tsx` initializes those fields in default project state
- `App.tsx` localStorage hydration merges parsed data with defaults (backward compatible shape evolution)
- Planning/suggestion entry points (`generateProjectPlan`, `suggestNextShotPlan`) are wired with expanded context fields
- Generation/review entry points include reference image context (`generateVideoAttempt`, `runAISelfReview`)
- `services/gemini.ts` consumes multimodal/project context (`audioIntent`, `contentConstraints`, `referenceImages`) and includes image prompt/config handling

**Maps to:**
- Expanded project model (audio intent, constraints, references)
- Backward-safe persistence/hydration for saved projects
- Rich planning context and multimodal generation/review behavior

---

## Contract 12: Rubric Completeness Check

**File:** `contracts/12_rubric_completeness.mjs`

**What it checks:**
- Before storing/displaying rubric from runAISelfReview, validate required fields exist
- validateRubric, validateSelfReviewRubric, or explicit field checks

**Maps to:** Trust gate — Rubric Completeness (avoid treating empty/invalid rubrics as evidence)

---

## Contract 13: Evidence Export Completeness

**File:** `contracts/13_evidence_export_completeness.mjs`

**What it checks:**
- exportBundle serializes full project (shots, validationReviews, outcomes)
- JSON.stringify(project) or equivalent

**Maps to:** Trust gate — Evidence Export Completeness

---

## Contract 14: Mandatory Outcome Coding Before Export

**File:** `contracts/14_mandatory_outcome_coding_before_export.mjs`

**What it checks:**
- Export gated or warned when outcomes are uncoded
- Check for outcome before export, or confirmation/warning

**Maps to:** Trust gate — Mandatory Outcome Coding Before Export

---

## Contract 15: Frame Sampling Quality Check

**File:** `contracts/15_frame_sampling_quality.mjs`

**What it checks:**
- Validate frames before runAISelfReview (length, dimensions)
- sampleFrames validates or app checks frames.length before use

**Maps to:** Trust gate — Frame Sampling Quality (prevents corrupted evidence)

---

## Contract 16: Error Classification Gate

**File:** `contracts/16_error_classification.mjs`

**What it checks:**
- types.ts defines FailureType, FailureVisibility taxonomy
- Errors use structured classification (not raw strings only)

**Maps to:** Trust gate — Error Classification (TR6, trust analysis)

---

## Contract 17: Trust Calibration Guidance

**File:** `contracts/17_trust_calibration_guidance.mjs`

**What it checks:**
- Outcome UI includes trustCalibration
- Guidance (tooltips, examples) for Under-trust / Calibrated / Over-trust

**Maps to:** Trust gate — Trust Calibration Guidance

---

## Contract 18: Continuity Metadata Honesty Check

**File:** `contracts/18_continuity_metadata_honesty.mjs`

**What it checks:**
- useSeed/useRefImage in metadata matches what is sent to Veo
- Either forward options to API or document the gap

**Maps to:** Trust gate — Continuity Metadata Honesty

---

## Adding New Contracts

1. Create `contracts/NN_name.mjs` with `export default async function run(ctx) { ... }`
2. Add import and entry to `scripts/run-contracts.mjs`
3. Update this document
