# Contract Modification Session — March 5, 2026

**Summary:** Implemented contracts 07–09, added contracts 12–18, fixed numbering, and cleaned up validation fixtures. All 18 contracts now pass.

---

## 1. Contracts Implemented (App Changes)

### Contract 07: Safe JSON Parse with Error Surfacing

**Trust gate:** Invalid rubrics/plans must not become `{}` with no visibility.

**App changes (`services/gemini.ts`):**
- Added `safeParseJson<T>(raw, fallback, context)` helper that wraps `JSON.parse` in try/catch
- On parse failure, throws with message: `AI response parse error (${context}): ${msg}. Raw preview: ...`
- Replaced bare `JSON.parse` in:
  - `runAISelfReview` → `safeParseJson<SelfReviewRubric>(...)`
  - `generateProjectPlan` → `safeParseJson<{ shots: ShotPlan[] }>(...)`
  - `suggestNextShotPlan` → `safeParseJson<ShotPlan>(...)`

### Contract 08: Video Generation Timeout (TR7)

**Trust gate:** Prevents indefinite hangs in the Veo polling loop.

**App changes (`services/gemini.ts`):**
- Added `VIDEO_GENERATION_MAX_WAIT_MS = 5 * 60 * 1000` (5 minutes)
- Added `VideoGenerationTimeoutError` class (extends Error)
- In `generateVideoAttempt` polling loop:
  - Set `deadline = Date.now() + VIDEO_GENERATION_MAX_WAIT_MS`
  - Before each poll, check `if (Date.now() > deadline)` → throw `VideoGenerationTimeoutError`
  - Error surfaces to UI via existing catch block

### Contract 09: Plan Structure Validation

**Trust gate:** Schema drift detection (H-S2) — validate plan structure before creating shots.

**App changes (`App.tsx`):**
- Added `REQUIRED_PLAN_FIELDS = ["narrativeIntent", "videoPrompt", "action"]`
- Added `validateShotPlan(plan, context?)` — checks required fields, throws if missing
- Call `validateShotPlan` before creating shots in:
  - `handleGeneratePlan` — validates each plan from `generateProjectPlan`
  - `handleSuggestNextShot` — validates plan from `suggestNextShotPlan`

---

## 2. New Contracts Added (Infra Only)

| ID | File | Trust Gate |
|----|------|------------|
| 12 | `contracts/12_rubric_completeness.mjs` | Rubric completeness — avoid treating empty/invalid rubrics as evidence |
| 13 | `contracts/13_evidence_export_completeness.mjs` | Evidence export completeness — full project serialization |
| 14 | `contracts/14_mandatory_outcome_coding_before_export.mjs` | Mandatory outcome coding before export |
| 15 | `contracts/15_frame_sampling_quality.mjs` | Frame sampling quality — prevent corrupted evidence |
| 16 | `contracts/16_error_classification.mjs` | Error classification for trust analysis (TR6) |
| 17 | `contracts/17_trust_calibration_guidance.mjs` | Trust calibration guidance (Under-trust / Calibrated / Over-trust) |
| 18 | `contracts/18_continuity_metadata_honesty.mjs` | Continuity metadata honesty — useSeed/useRefImage matches API |

Each contract performs static analysis (grep/pattern checks) on app source. See `docs/CONTRACTS.md` for full specifications.

---

## 3. Other Changes

### Contract 06: API Key Validation
- **Removed** `__VALIDATION_ONLY_REMOVE_ME__` from `AI_ENTRY_POINTS` in `contracts/06_api_key.mjs`
- **Removed** `__VALIDATION_ONLY_REMOVE_ME__` export from `services/gemini.ts` (app)
- This fixture was used to validate the contract failure path; no longer needed

### Contract 10: Numbering Fix
- **Renamed** `contracts/06_no_generate_without_acceptance.mjs` → `contracts/10_no_generate_without_acceptance.mjs`
- Resolved duplicate "06" (both API key and no-generate-without-acceptance used 06)
- Updated import in `scripts/run-contracts.mjs`
- Updated `docs/CONTRACTS.md`

### Run-Contracts Script
- Enabled contracts 07, 08, 09 (were previously commented out)
- Added imports and entries for contracts 12–18

### CONTRACTS.md
- Documented Contract 10 (was missing)
- Added sections for Contracts 12–18

---

## 4. File-Level Summary

### App Repo (`UNCC-8-Second-Story-Movie-Builder`)

| File | Changes |
|------|---------|
| `services/gemini.ts` | `safeParseJson`, `VideoGenerationTimeoutError`, timeout logic, removed `__VALIDATION_ONLY_REMOVE_ME__` |
| `App.tsx` | `validateShotPlan`, `REQUIRED_PLAN_FIELDS`, validation calls in `handleGeneratePlan` and `handleSuggestNextShot` |

### Infra Repo (`UNCC-8-Second-Story-Movie-Builder-infra`)

| File | Changes |
|------|---------|
| `contracts/06_api_key.mjs` | Removed `__VALIDATION_ONLY_REMOVE_ME__` from `AI_ENTRY_POINTS` |
| `contracts/10_no_generate_without_acceptance.mjs` | New file (renamed from 06) |
| `contracts/06_no_generate_without_acceptance.mjs` | Deleted |
| `contracts/12_rubric_completeness.mjs` | New |
| `contracts/13_evidence_export_completeness.mjs` | New |
| `contracts/14_mandatory_outcome_coding_before_export.mjs` | New |
| `contracts/15_frame_sampling_quality.mjs` | New |
| `contracts/16_error_classification.mjs` | New |
| `contracts/17_trust_calibration_guidance.mjs` | New |
| `contracts/18_continuity_metadata_honesty.mjs` | New |
| `scripts/run-contracts.mjs` | Imports and contract list for 07–09, 10, 12–18 |
| `docs/CONTRACTS.md` | Contract 10 doc, Contracts 12–18 docs |

---

## 5. Commits

| Repo | Commit | Message |
|------|--------|---------|
| **Infra** | `b3e9b4f` | feat: implement contracts 07-09, add contracts 12-18, fix numbering |
| **App** | `caea054` | feat: implement trust gate contracts 07, 08, 09 |

---

## 6. Verification

Run contracts locally:

```powershell
cd UNCC-8-Second-Story-Movie-Builder-infra
$env:APP_DIR = "..\UNCC-8-Second-Story-Movie-Builder"
node scripts/run-contracts.mjs
```

Expected: All 18 contracts pass.
