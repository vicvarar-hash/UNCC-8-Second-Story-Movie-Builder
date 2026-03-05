# Project folder exploration and error validation
_Exported on 2/17/2026 at 18:32:57 EST from Cursor (2.4.37)_

---

**User**

g'day. dig into @group project/L10 @group project/L11 @group project/UNCC-8-Second-Story-Movie-Builder @group project/UNCC-8-Second-Story-Movie-Builder-infra these folders and get familiarized with our project and progress. We're in L11. One thing I'd like to do is identify one way we could tweak our @group project/UNCC-8-Second-Story-Movie-Builder-infra/contracts/06_api_key.mjs to make it throw an error when we run it, just for validation

---

**Cursor**


Exploring the project folders and the `api_key` contract.



Exploring the project structure:



Checking how contracts are run and the GitHub workflow:



Summarizing and proposing a tweak:

Project summary:
- UNCC-8-Second-Story-Movie-Builder: React/Vite app for AI-assisted 8-second movie production (Gemini, Veo).
- UNCC-8-Second-Story-Movie-Builder-infra: contracts, CI, docs.
- L10: trust gates, discussion questions.
- L11: vibe coding and trust when AI writes code.

Contract 06 (`06_api_key.mjs`) checks:
1. `validateApiKey` or `ensureApiKey` exists in `gemini.ts`
2. Throws with a clear message when the API key is missing
3. All four AI entry points exist: `generateProjectPlan`, `suggestNextShotPlan`, `runAISelfReview`, `generateVideoAttempt`

`gemini.ts` satisfies these checks, so the contract passes.

Proposed tweak: add a fake required entry point to `AI_ENTRY_POINTS` so the contract fails with a clear message. Easiest one-line change:



Running the contract suite to confirm it fails:



Checking how the script resolves paths and running with the correct APP_DIR:



Contract 06 is now failing with:

```
❌ [06] API key validation (trust gate, TR6)
   Missing AI entry points: __VALIDATION_ONLY_REMOVE_ME__
```

**What changed**

A fake entry point `"__VALIDATION_ONLY_REMOVE_ME__"` was added to `AI_ENTRY_POINTS`. Because `gemini.ts` doesn’t define it, the contract fails with a clear message.

**To restore passing contracts**

Remove that line from `06_api_key.mjs`:

```javascript
"__VALIDATION_ONLY_REMOVE_ME__", // temporary: forces contract to fail for validation
```

**Other options for future validation**

1. **Require a non-existent validation function** – e.g. change the check to require `validateApiKeyStrict` instead of `validateApiKey`.
2. **Require a marker string** – add a check like `text.includes("__GEMINI_TRUST_GATE_MARKER__")` that will fail until you add that comment to `gemini.ts`.

The fake entry point approach is simple and easy to revert.

---

**User**

Excellent. Please document the change made and how to revert in @group project/dylan/contributions/2-12 after class fiddlin 

---

**Cursor**


Documented the change in `2-12 after class fiddlin`, including what was modified, the resulting failure message, and how to revert it.

---

**User**

excellent, thank you. now I'd like you to please identify and inform me in the chat window only what you feel the next point of focus should be for the project?

---

**Cursor**


Here’s what looks like the best next focus:

---

**Primary focus: Fix Contract 03 (types lineage)**

Contract 03 is failing because `GenerationAttempt` in `types.ts` is missing `parentAttemptId` and `promptSource`. These fields support FR7 (Attempt Lineage) and lineage preservation, which are central to the trust/evidence model. Fixing this will get the contract suite passing (aside from the intentional Contract 06 failure) and keep CI green.

---

**Secondary focus: Trust gates from L10**

Several trust gates from your L10 doc are still unimplemented. A strong next candidate is **Safe JSON Parse with Error Surfacing**: wrapping `JSON.parse` in try/catch and surfacing parse errors to the UI instead of silently returning `{}`. That directly addresses the “invalid rubrics/plans become `{}` with no visibility” gap and would be a good follow-up after Contract 03.

---

**Optional cleanup**

Remove the `__VALIDATION_ONLY_REMOVE_ME__` entry from Contract 06 once you’re done validating the failure path, so the suite reflects the real state of the app.

---

**User**

Alright, let's take a look at the remaining trust gates and choose 3 to implement?

---

**Cursor**


Here’s a concise view of the remaining trust gates and a suggested set of 3 to implement.

---

## Remaining trust gates (API Key already done)

| Category | Gate | Effort | Impact |
|----------|------|--------|--------|
| **Input** | Frame Sampling Quality Check | Medium | Prevents corrupted evidence from bad frames |
| **Structural** | Safe JSON Parse with Error Surfacing | Low | Critical gap – invalid rubrics/plans become `{}` silently |
| **Structural** | Plan Structure Validation | Low–Medium | Catches schema drift before invalid data propagates |
| **Structural** | Rubric Completeness Check | Low | Avoids treating empty/invalid rubrics as valid evidence |
| **Operational** | Video Generation Timeout | Low | Prevents indefinite hangs in the Veo polling loop |
| **Operational** | Continuity Metadata Honesty Check | Medium | Flags mismatches between metadata and what was sent to Veo |
| **Evidence** | Evidence Export Completeness | Medium | Ensures exported bundle is complete before export |
| **Evidence** | Error Classification Gate | Medium | Classifies errors for trust analysis (TR6) |
| **Human** | Mandatory Outcome Coding Before Export | Medium | Requires outcome coding before export |
| **Human** | Trust Calibration Guidance | Low | Adds examples for Over-trust / Under-trust / Calibrated |

---

## Recommended 3 to implement

### 1. **Safe JSON Parse with Error Surfacing**
- **Why:** Directly addresses the “critical gap” in the doc: invalid rubrics/plans currently become `{}` with no visibility.
- **Where:** `gemini.ts` – 3 `JSON.parse` calls (lines 145, 229, 258).
- **Scope:** Wrap each in try/catch, surface error type and message to the UI, and avoid returning `{}` on failure.

### 2. **Video Generation Timeout**
- **Why:** The Veo polling loop can run indefinitely; the doc calls out TR7 and preventing hangs.
- **Where:** `gemini.ts` – `generateVideoAttempt` (around lines 284–286).
- **Scope:** Add a max wait (e.g. 5 minutes), throw `TimeoutError` on timeout, and surface it to the UI.

### 3. **Plan Structure Validation**
- **Why:** Validates parsed plans before creating shots, so schema drift is caught early.
- **Where:** `App.tsx` – after `generateProjectPlan` and `suggestNextShotPlan` return.
- **Scope:** Check required fields (`narrativeIntent`, `videoPrompt`, `action`, etc.) and types before creating shots; reject with a structured error if invalid.

---

These three are relatively small, high-impact changes that improve failure surfacing and trust, and they fit well with the L11 focus on trusting AI-generated code.

---

**User**

okay, draft up the contracts please.

---

**Cursor**


Checking how plans are used in App.tsx and the gemini service structure:



Creating the three contract files and updating the runner and docs.



Tightening contract 09: `plan.narrativeIntent` can appear in display code. Requiring explicit validation:



Running the contract suite to verify it runs:



Summary of what was added:

---

## New contracts

### **07_safe_json_parse.mjs**
- Ensures `gemini.ts` wraps `JSON.parse` in try/catch and throws on failure
- Disallows bare `return JSON.parse(response.text || '{}')`
- Ensures parse errors are surfaced instead of returning `{}`

### **08_video_timeout.mjs**
- Ensures `generateVideoAttempt` has timeout logic in the Veo polling loop
- Accepts: `TimeoutError`, `timeout`, `maxWait`, `300000`, `5*60*1000`, `deadline`, or `Date.now()` with the loop
- Ensures the polling loop cannot run indefinitely

### **09_plan_structure_validation.mjs**
- Ensures plan structure is validated before creating shots
- Accepts: `validatePlan`, `validateShotPlan`, `validatePlanStructure`, or explicit checks like `!p.narrativeIntent`, `!plan.videoPrompt`
- Ensures invalid plans cause a throw or surfaced error instead of being used silently

---

## Files changed

- **Created:** `contracts/07_safe_json_parse.mjs`, `contracts/08_video_timeout.mjs`, `contracts/09_plan_structure_validation.mjs`
- **Updated:** `scripts/run-contracts.mjs` (imports and contract list)
- **Updated:** `docs/CONTRACTS.md` (documentation for 07, 08, 09)

---

## Current run result

All three new contracts fail as expected (the features are not implemented yet). After reverting the Contract 06 validation tweak, the suite will fail on 03, 07, 08, and 09 until those features are implemented.

---

**User**

and you added these to the correct import area in the..I forget the name..the contract exeution file?

---

**Cursor**


Yes. In `scripts/run-contracts.mjs` (the contract execution file), the new contracts are wired up in both places:

1. **Imports** (lines 10–12):
```javascript
import c07 from "../contracts/07_safe_json_parse.mjs";
import c08 from "../contracts/08_video_timeout.mjs";
import c09 from "../contracts/09_plan_structure_validation.mjs";
```

2. **Contract list** (lines 35–37):
```javascript
{ id: "07", name: "Safe JSON parse with error surfacing", run: c07 },
{ id: "08", name: "Video generation timeout (TR7)", run: c08 },
{ id: "09", name: "Plan structure validation before shots", run: c09 },
```

They’re in the right place and will run in order with the rest of the suite.

---

**User**

Perfect, thank you! Let's push these changes

sorry, there are two repos. both of the 8 second folders are their own repos, infra for the contracts, regular for the real project

---

**Cursor**


Staging, committing, and pushing changes in the infra repo.



Pulling remote changes and pushing.


---

**User**

check the status. did our push complete? don't push yet if it didn't. I want to make sure we're not doing the same work that a teammember completed

---

**Cursor**


Status looks good:

- **Branch:** `main` is up to date with `origin/main`
- **Working tree:** clean, nothing to commit
- **Latest commit:** `4beaea3` — "Add trust gate contracts 07-09: safe JSON parse, video timeout, plan validation"

So the push has completed and your changes are on the remote. No further push is needed, and you’re not duplicating any teammate’s work.

---

**User**

what changed came with the pull before we pushed?

---

**Cursor**


The pull brought in one commit from your teammate (vicvarar-hash):

---

**Commit `c8831c9` — "Update 03_types_lineage.mjs"**

**Summary:** Contract 03 was updated so it passes with the current `types.ts` definitions.

**Changes:**
- **Before:** One large regex that required `parentAttemptId` and `promptSource` to have specific types (`string`, `string | null`, etc.).
- **After:** The contract now:
  1. Extracts the `Shot` and `GenerationAttempt` interface blocks with `extractInterfaceBlock()`.
  2. Checks each block separately with `mustContainLine()`.
  3. Relaxes the type checks for `parentAttemptId` and `promptSource` so they only need to be present (optional `?` allowed), not a specific type.

So the contract still enforces `attempts`, `acceptedAttemptId`, `parentAttemptId`, and `promptSource`, but it’s more flexible about how those fields are declared. That should fix the Contract 03 failures we saw earlier.

---

**User**

oh okay rad. so we're up-to-date then?

---

**Cursor**


Yes. The infra repo is up to date with `origin/main`, and the working tree is clean.

