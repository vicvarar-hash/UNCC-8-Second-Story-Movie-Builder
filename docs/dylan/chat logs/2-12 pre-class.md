# Group project folder review
_Exported on 2/12/2026 at 17:10:26 EST from Cursor (2.4.28)_

---

**User**

Take a look at the contents of the group project folder with added focus on L9 and L10. once you're satisfied, I'd like to discuss current status and next steps

---

**Cursor**


Here’s a concise snapshot of the project and L9/L10 status.

---

## Current Status Summary

### Project: AI-Assisted Movie Production System (8-Second Story Builder)

**Goal:** A controlled environment for studying trust failures in AI-generated media, not only for creative output.

**Team:** Víctor H. Vargas, Theodore Japit, Dylan Christensen

**Application:** `UNCC-8-Second-Story-Movie-Builder` – React app with Plan → Produce → Validate → Export phases. It:
- Generates shot plans via Gemini
- Generates 8-second videos via Veo
- Runs AI self-review (narrative, visual, continuity, physics)
- Collects outcome coding (failure type, visibility, trust calibration)
- Exports evidence bundles as JSON

---

## L9 (Integration Planning) – Status

**L9 Focus:** Move from planning to execution; integration plan, not working pipeline.

**Deliverables:**
- [ ] Integration plan (sequence of steps for first end-to-end run)
- [ ] Assigned primary/secondary owners
- [ ] Shared expectation that the initial pipeline will fail in informative ways

**Documentation:** Design v1.1 describes pipeline stages and trust gates, but there is no separate L9 integration plan (sequence, ownership, acceptance of early failures).

---

## L10 (First Pipeline Run) – Status

**L10 Focus:** Run the pipeline end-to-end, surface failures, document evidence.

**Deliverables:**
- [ ] Trust gates implemented (simple/placeholder form)
- [ ] Pipeline run end-to-end at least once
- [ ] Failures logged and documented (what failed, where, which assumptions were violated)

**Application:** The app runs end-to-end (plan → generate → review → export), but:
- Trust gates are mostly placeholders or gaps (see Design v1.1)
- No explicit failure-logging or documentation process
- Professor’s questions are not answered

---

## Professor’s Questions (L10)

1. **How did you verify requirements?**  
   Partially answered in requirements analysis (discrepancy detection, validation criteria), but not summarized for L10.

2. **How will you verify the design?**  
   Design v1.1 includes pipeline stages and trust gates, but there’s no verification plan.

3. **More ideas for the trust gates.**  
   Need expansion beyond the current mapping (e.g., schema checks, timeouts, error surfacing).

---

## Gaps vs. Design v1.1

| Gap | Impact |
|-----|--------|
| `useSeed` / `previousVideoUrl` never used | Continuity claims are misleading |
| Unchecked JSON parsing | Silent failures, empty rubrics |
| No timeout on video generation | Possible infinite hangs |
| Errors not surfaced in UI | TR6 (Failure Surfacing) not met |
| Evidence export incomplete | Missing API logs, error details |

---

## Recommended Next Steps

1. **Answer the professor’s questions**  
   - How requirements were verified (e.g., discrepancy detection, L3/L4 analysis)  
   - How design will be verified (stages, gates, manual tests)  
   - Additional trust gate ideas (e.g., schema validation, timeout detection, error surfacing)

2. **Write an L9 integration plan**  
   - Step-by-step sequence for first end-to-end run  
   - Primary/secondary owners per step  
   - Explicit acceptance that early runs will fail

3. **Execute and document one L10 run**  
   - Run the pipeline end-to-end  
   - Log failures (what/where/assumptions)  
   - Commit even if failing, per L10 philosophy

4. **Implement a few high-impact trust gates**  
   - Safe JSON parsing with error surfacing  
   - Timeout on video generation  
   - Basic schema validation (e.g., shot plans, rubrics)

5. **Decide on continuity**  
   - Either wire `useSeed`/`previousVideoUrl` to Veo, or document them as unsupported and remove misleading metadata.

---

If you share what you want to prioritize (e.g., professor answers, integration plan, or gate implementation), we can draft concrete text or implementation steps for that part first.

---

**User**

I think the first, most straightforward option is answering the questions posed by the Professor. 

---

**Cursor**


Drafting answers to the professor's questions using the project materials.



Drafting answers grounded in the project materials and adding them to the L10 folder.



I've added a responses document at `L10\responses_to_professor.md`. Summary:

---

**1. How did you verify requirements?**
- Reverse engineering from the codebase to find mismatches with requirements
- Discrepancy detection (L3/L4): turning backend gaps into trust hypotheses and classifying requirements
- Evidence-based: what the system actually does vs. what it claims, rather than formal traceability

---

**2. How will you verify the design?**
- By running the pipeline end-to-end and logging failures
- Trust gate status: implementing placeholders and logging pass/fail
- Split into automatable checks (schema, timeouts) vs. human judgment (outcome coding)
- Evidence bundle completeness as a design verification criterion

---

**3. More ideas for the trust gates**
- **Input/pre-conditions:** API key validation, frame sampling quality
- **Structural:** Safe JSON parse with error surfacing, plan structure validation, rubric completeness
- **Operational:** Video generation timeout, continuity metadata honesty check
- **Evidence:** Export completeness, error classification
- **Human-in-the-loop:** Mandatory outcome coding before export, trust calibration guidance
- **Future:** Cross-shot continuity analysis, prompt revision linkage

---

The responses are anchored in your existing work (critical assessment, L3/L4 findings, Design v1.1). If you want edits—e.g., shorter answers, different tone, or more emphasis on specific items—say what to change.

---

**User**

Excallent, thank you. What is the next order of business?

---

**Cursor**


Given where you are (professor’s questions answered), the next priorities are:

---

## 1. Run the L10 pipeline end-to-end

You’ve stated that design verification happens by running the pipeline and documenting failures. That’s the next concrete step:

- Run the app: Plan → Produce → Validate → Export  
- Use at least one preset script (e.g., “Script 2: Plausible Planning Errors”)  
- Note what fails, where it fails, and which assumptions are violated  
- **Commit the failure log** as evidence (even if failures occur)

Per L10, “if your pipeline failed today, that is a success.” You need one documented run before you can refine.

---

## 2. Add a minimal L9 integration plan (if you don’t have one)

If you haven’t already, capture a short integration plan:

- Step-by-step sequence for the first end-to-end run  
- Who owns each step (primary/secondary)  
- A short note that the first run is expected to fail in informative ways  

This can be a few paragraphs or a short checklist; it doesn’t need to be long.

---

## 3. Implement 1–2 high-impact trust gates

To make failures visible instead of silent:

- **Safe JSON parse** – wrap `JSON.parse` in try-catch, surface errors to the UI, and log them  
- **Video generation timeout** – add a max wait (e.g., 5 minutes) in the polling loop  

These directly address the most critical gaps (silent failures, indefinite hangs) and align with your responses to the professor.

---

## 4. Decide on continuity

You currently record `useSeed: true` in metadata without passing it to the API. You should either:

- **Implement** – wire `useSeed` and `previousVideoUrl` to the Veo API (if supported), or  
- **Remove or clarify** – stop recording continuity metadata if it’s not actually used, and document that in the design/requirements  

---

## Suggested order

1. **Run the pipeline once** and document the failures (about 30–60 minutes).  
2. **Add a short integration plan** if it’s missing (about 15 minutes).  
3. **Implement safe JSON parse** so failures are visible instead of silent (about 30 minutes).  
4. **Add a video generation timeout** to avoid indefinite hangs (about 20 minutes).  
5. **Decide on continuity** and update docs/code accordingly.

If you say which step you want to do first (e.g., “run the pipeline” or “implement safe JSON parse”), I can help you execute it step by step.

---

**User**

First, let's verify which of these, if any, is already implemented

---

**Cursor**


Verification status for each item:

---

## Implementation verification

### 1. Safe JSON parse with error surfacing — **not implemented**

**Location:** `services/gemini.ts` lines 134, 217, 245

- `JSON.parse(response.text || '{}')` — no try-catch around parsing
- Empty `response.text` → parses `'{}'` → returns empty shots/rubrics without error
- Malformed JSON → parse throws → caught by App handlers (e.g. `handleGeneratePlan` catch) and shown via `alert(e.message)`
- **Gap:** Valid JSON with wrong structure (e.g. `{ shots: [] }`) is treated as success. No schema/structure validation.

---

### 2. Video generation timeout — **not implemented**

**Location:** `services/gemini.ts` lines 268–274

```typescript
let operation: any = await ai.models.generateVideos(requestPayload);
while (!operation.done) {
  await new Promise(resolve => setTimeout(resolve, 10000));
  operation = await ai.operations.getVideosOperation({ operation: operation });
}
```

- No max wait time; loop can run indefinitely
- `setTimeout(10000)` is just the polling interval, not a timeout

---

### 3. API key validation (pre-call) — **not implemented**

**Location:** `services/gemini.ts` lines 5–15, 94, 193, 222, 253

- `getCurrentApiKey()` can return `''` when no key is found
- AI calls use `apiKey` directly; no check before making requests
- Failures occur in the API layer with unclear messages

---

### 4. Plan structure validation — **not implemented**

**Location:** `App.tsx` lines 127–136

```typescript
const plans = await generateProjectPlan(...);
const newShots: Shot[] = plans.map((p, i) => ({
  plan: p,  // No validation that p has required fields
  ...
}));
```

- No check that `plans` is an array
- No validation of required fields (`narrativeIntent`, `videoPrompt`, etc.)
- Invalid plans can propagate and cause later errors

---

### 5. Rubric completeness check — **not implemented**

**Location:** `App.tsx` lines 323–341, `services/gemini.ts` line 134

- `runAISelfReview` returns `JSON.parse(response.text || '{}')`; on empty response, rubric is `{}`
- `renderRubric` assumes `rubric.narrativeConsistency`, etc. exist → can crash with `undefined.score`
- No validation of score ranges (1–5) or dimensions before use

---

### 6. Evidence export completeness — **not implemented**

**Location:** `App.tsx` lines 303–311

```typescript
const exportBundle = () => {
  const data = JSON.stringify(project, null, 2);
  // ... no checks before export
};
```

- Exports `project` as-is
- No checks for: all attempts, lineage links, outcome coding on accepted shots
- No inclusion of API logs or structured error details

---

### 7. Frame sampling quality check — **not implemented**

**Location:** `services/gemini.ts` lines 54–86

- `sampleFrames` rejects on `video.onerror`
- No check that frames array is non-empty
- No validation of frame dimensions or content before passing to self-review

---

### 8. Continuity (`useSeed` / `previousVideoUrl`) — **not implemented**

**Location:** `services/gemini.ts` lines 250–268

- `previousVideoUrl` is accepted but never used in the request
- `options.useSeed` is stored in metadata but not passed to the Veo API
- `requestPayload` has no seed or reference image; continuity options are metadata-only

---

### 9. L9 integration plan — **not present**

**Location:** `L9/` folder

- Only `info` and `L9_itcs6010_v1.0.pdf`
- No integration plan document (sequence, ownership, etc.)

---

### 10. Error surfacing to UI — **partial**

| Flow | Error handling |
|------|----------------|
| `handleGeneratePlan` | try-catch → `alert(e.message)` |
| `handleSuggestNextShot` | try-catch → `alert(e.message)` |
| `handleGenerateShot` | try-catch → sets status to `'error'`; no alert with message |
| `handleRunSelfReview` | try-catch → `alert("Self-review failed: " + e.message)` |
| `handleRunValidationReview` | try-catch → `alert("Validation failed: " + e.message)` |
| Video generation errors | Stored in `attempt.error`; UI shows red X icon, but the error message is not clearly shown |

- Outer handlers catch thrown errors and show alerts
- Video generation errors are stored but not prominently displayed
- JSON parsing failures that throw are surfaced; successful parse of invalid structure is not detected

---

## Summary table

| Item | Status |
|------|--------|
| Safe JSON parse | ❌ Not implemented |
| Video generation timeout | ❌ Not implemented |
| API key validation | ❌ Not implemented |
| Plan structure validation | ❌ Not implemented |
| Rubric completeness check | ❌ Not implemented |
| Evidence export completeness | ❌ Not implemented |
| Frame sampling quality check | ❌ Not implemented |
| Continuity (useSeed / previousVideoUrl) | ❌ Not implemented |
| L9 integration plan | ❌ Not present |
| Error surfacing to UI | ⚠️ Partial (some flows surfaced, video errors not) |

None of the listed trust gates or improvements are fully implemented. The next step is to choose which ones to implement first (e.g. safe JSON parse and video timeout).

---

**User**

let's hammer out an L9 integration plan

---

**Cursor**


Created the L9 integration plan at `L9\integration_plan.md`. Summary:

---

## L9 Integration Plan Summary

### 1. Shared understanding
- First run is expected to fail in informative ways.
- Success = pipeline runs end-to-end + failures are visible and documented.

### 2. Integration sequence (5 steps)

| Step | Phase | Primary owner | Focus |
|------|-------|---------------|--------|
| 1 | Plan | Víctor | API key check, plan generation, shot validation |
| 2 | Produce | Theodore | Video generation per shot, error logging |
| 3 | Self-Review + Outcome Coding | Dylan | AI self-review, rubric check, outcome coding |
| 4 | Validate (optional) | Dylan | External video upload/review |
| 5 | Export | Dylan | Bundle export, completeness check |

Each step has a primary and secondary owner.

### 3. Trust gates (simplest form)
- **API key check** – pre-call validation (can be implemented quickly).
- **Plan validation** – manual: “Did we get shots?”
- **Video error surfacing** – error visible in UI.
- **Self-review failure** – manual: “Did rubric parse?”
- **Export completeness** – manual: inspect JSON and note gaps.

### 4. Placeholders
- JSON validation, video timeout, schema checks → manual observation for first run.
- Continuity (`useSeed`, `previousVideoUrl`) → documented as not implemented.

### 5. Deliverables
- **Execution checklist** – before/during/after run.
- **Failure log template** – what failed, where, assumptions violated.
- **Success criteria for L9 → L10** – sequence, ownership, shared understanding, failure template.

---

**Ownership note:** Assignments (Víctor, Theodore, Dylan) are placeholders. You can change them to match actual roles or preferences.

If you want edits (e.g., different ownership, more detail on a step, or changes to the failure log template), say what to update.

---

**User**

let's remove the assignments

---

**Cursor**


Finished. All ownership and assignment references have been removed across the integration plan:

- **Purpose** — no longer mentions “ownership”
- **Task tables** (Steps 1–5) — only Priority and Task columns remain
- **Trust gates table** — Owner column removed
- **Failure log template** — “Owner who observed” removed
- **Red flags** — “Unclear ownership” bullet removed
- **Success criteria** — “Ownership is assigned for every step” removed, numbering adjusted

---

**User**

perfect, thank you. what is the next step? don't take it, jst tell me

---

**Cursor**


The next step is to **run the first end-to-end pipeline**.

That means:

1. Start the app (`npm run dev`)
2. Load a preset script (e.g., "Script 2: Plausible Planning Errors")
3. Walk through Plan → Produce → Validate → Export
4. Record outcomes in the failure log as you go
5. Export the evidence bundle and note what’s missing

That gives you concrete evidence for L10 and a basis for deciding which trust gates to implement first.

