# Critical Assessment: System Requirements vs. Codebase Reality

**Date:** January 22, 2026  
**Analyst:** Dylan Christensen  
**Method:** Reverse engineering from codebase to identify trust gaps and assumptions

---

## Executive Summary

This analysis works backwards from the implemented codebase to identify critical trust gaps, missing requirements, and silent failure modes that undermine the system's trustworthiness. The assessment reveals that while the frontend has sophisticated trust evaluation mechanisms (outcome coding, evidence export, AI self-review), the **backend AI integration layer has numerous silent failure patterns** that compromise trust evaluation reliability.

**Key Finding:** The ambitious frontend trust mechanisms are built on a backend foundation with critical trust gaps, particularly around error handling, validation, and continuity mechanisms.

---

## Part 1: Missing Requirements (Frontend-Backend Disconnect)

### 1.1 Evaluation Mode and Outcome Coding
**Code Reality:**
- `evaluationMode: true` hardcoded in App.tsx
- `Outcome` interface with structured failure classification:
  - `failureType`: None | Continuity Drift | Hallucination | Instruction Following | Physics Violation | Aesthetic Failure
  - `failureVisibility`: Fully visible | Partially visible | Silent
  - `trustCalibration`: Under-trust | Calibrated | Over-trust
  - `correctionEffort`: Low | Medium | High
  - `notes`: Human observation field

**Requirements Gap:**
- No requirement mentions evaluation mode
- No requirement for structured outcome coding
- No requirement for failure classification taxonomy

**Trust Issue:** System is built for research/evaluation but requirements don't acknowledge this purpose.

---

### 1.2 AI Self-Review with Prompt Revision
**Code Reality:**
- `runAISelfReview()` generates structured rubric:
  - Scores (1-5) for: Narrative Consistency, Visual Fidelity, Continuity, Physics & Logic
  - Overall confidence level (Low/Medium/High)
  - **Optional `promptRevision`** with revised prompt and change list
- Self-review uses AI to review AI outputs (recursive trust dependency)

**Requirements Gap:**
- FR5 mentions "evaluative feedback" but not structured self-review
- No requirement for prompt revision suggestions
- No requirement acknowledging recursive AI usage

**Trust Issue:** System uses AI to evaluate AI, creating a trust dependency chain that should be explicit.

---

### 1.3 Attempt Lineage and Regeneration Tracking
**Code Reality:**
- `GenerationAttempt` tracks:
  - `promptSource`: 'original' | 'self_review_revision' | 'manual_edit'
  - `parentAttemptId`: Links regeneration attempts
  - Full attempts array per shot for lineage tracking

**Requirements Gap:**
- No requirement for attempt tracking
- No requirement for regeneration history
- No requirement for lineage evidence

**Trust Issue:** Requirements don't capture that users can regenerate with different sources, affecting trust evaluation.

---

### 1.4 Validation Phase for External Videos
**Code Reality:**
- Separate "validate" phase allows uploading external videos (clips or full movies)
- AI reviews uploaded videos independently of production workflow
- Validation reviews stored separately from production shots

**Requirements Gap:**
- No requirement for validating external videos
- No requirement for separate validation workflow

**Trust Issue:** System can evaluate videos from other sources, which should be a requirement.

---

### 1.5 Evidence Bundle Export
**Code Reality:**
- `exportBundle()` exports entire project as JSON:
  - All shot plans, attempts, lineage
  - Human outcome coding
  - AI self-reviews
  - Validation reviews
  - Complete evidence trail

**Requirements Gap:**
- FR6 mentions "export" but only for assembled videos
- No requirement for evidence bundle export

**Trust Issue:** System is designed to export evidence for research, which should be explicit.

---

## Part 2: Critical Backend Trust Gaps

### 2.1 Silent JSON Parsing Failures ⚠️ CRITICAL

**Location:** `services/gemini.ts` lines 134, 217, 245

```typescript
// Line 134: runAISelfReview
return JSON.parse(response.text || '{}');

// Line 217: generateProjectPlan  
const parsed = JSON.parse(response.text || '{"shots":[]}');
return parsed.shots;

// Line 245: suggestNextShotPlan
return JSON.parse(response.text || '{}');
```

**Trust Issues:**
1. **No try-catch:** If JSON is malformed, `JSON.parse` throws unhandled exception
2. **Silent fallbacks:** Empty objects returned if `response.text` is null/undefined
3. **No validation:** Parsed JSON not validated against expected structure
4. **Type safety illusion:** TypeScript types don't prevent runtime errors

**Impact:**
- Empty shot plans created silently
- Self-review returns empty rubrics without error
- Invalid data flows through system undetected
- Frontend may render invalid data as valid

**Evidence Gap:** These failures are not logged or surfaced, making them impossible to detect in trust evaluation.

---

### 2.2 No Runtime Schema Validation ⚠️ CRITICAL

**Location:** All AI generation functions

**Trust Issue:**
- `responseSchema` in API config doesn't guarantee runtime compliance
- No validation that parsed JSON matches expected structure
- No check that required fields exist or have correct types
- TypeScript types provide compile-time safety but no runtime protection

**Example:**
```typescript
// generateProjectPlan returns parsed.shots without checking:
// - Is parsed.shots an array?
// - Does each shot have required fields?
// - Are field types correct?
```

**Impact:**
- Type mismatches propagate silently
- Missing required fields cause runtime errors later
- Invalid data corrupts trust evaluation evidence

---

### 2.3 API Key Handling with Silent Fallback ⚠️ HIGH

**Location:** `services/gemini.ts` lines 5-15

```typescript
export const getCurrentApiKey = (): string => {
  // ... checks ...
  return process.env.API_KEY || '';  // Returns empty string!
};
```

**Trust Issue:**
- Returns empty string if no key found
- Empty string passed to GoogleGenAI, which fails later
- Failure happens downstream, obscuring root cause
- No early validation or clear error message

**Impact:**
- Misleading error messages
- Difficult to diagnose missing API key
- Wastes API calls that will fail

---

### 2.4 Infinite Polling Loop with No Timeout ⚠️ CRITICAL

**Location:** `services/gemini.ts` lines 270-274

```typescript
let operation: any = await ai.models.generateVideos(requestPayload);
while (!operation.done) {
  await new Promise(resolve => setTimeout(resolve, 10000));
  operation = await ai.operations.getVideosOperation({ operation: operation });
}
```

**Trust Issues:**
1. **Infinite loop:** If operation never completes, loop runs forever
2. **No timeout:** No maximum wait time
3. **No retry limit:** No maximum retry count
4. **No error handling:** Operation errors not caught

**Impact:**
- Browser tab can hang indefinitely
- No way to detect stuck operations
- Resource waste
- Poor user experience

---

### 2.5 Continuity Seed Not Implemented ⚠️ CRITICAL

**Location:** `services/gemini.ts` line 250, 288

```typescript
export const generateVideoAttempt = async (
  shotPlan: ShotPlan, 
  options: { useSeed: boolean, useRefImage: boolean, requestExplanation: boolean },
  previousVideoUrl?: string  // ← Parameter exists but is NEVER USED
): Promise<Partial<GenerationAttempt>> => {
  // ...
  // No code that actually uses previousVideoUrl or options.useSeed
  // Metadata records useSeed: true, but seed is never passed to API
}
```

**Trust Issues:**
1. **False metadata:** `useSeed: true` recorded but seed never used
2. **Ignored parameter:** `previousVideoUrl` completely ignored
3. **Non-functional feature:** Continuity mechanism doesn't work
4. **Requirements mismatch:** FR4 claims continuity support, but it's not implemented

**Impact:**
- Continuity failures expected but not actually attempted
- Evidence collection records false continuity attempts
- Trust evaluation based on incorrect assumptions
- Users believe continuity is working when it's not

---

### 2.6 Error Handling That Swallows Context ⚠️ HIGH

**Location:** `services/gemini.ts` line 290-297

```typescript
} catch (error: any) {
  console.error("[Veo] Attempt failed:", error);
  return {
    error: error.message || "Generation failed",  // Generic message
    // ... but no error type, no error code, no retry info
  };
}
```

**Trust Issues:**
1. **Console-only logging:** Errors only in console (not visible in production)
2. **Generic messages:** Context lost in generic error messages
3. **No classification:** Can't distinguish rate limits, API errors, network failures
4. **No error taxonomy:** No structured error types for trust analysis

**Impact:**
- Difficult to diagnose failures
- Cannot distinguish failure types for trust analysis
- Evidence collection lacks error context
- Trust evaluation cannot categorize failures

---

### 2.7 Frame Sampling with No Validation ⚠️ MEDIUM

**Location:** `services/gemini.ts` lines 55-88

```typescript
export const sampleFrames = async (videoSrc: string | File, count: number = 3): Promise<string[]> => {
  // ...
  video.onerror = () => reject(new Error("Failed to load video for sampling."));
  // But what if video loads but has 0 duration?
  // What if canvas context is null?
  // What if frames are all black/empty?
}
```

**Trust Issues:**
1. **No frame validation:** No check that frames were successfully extracted
2. **No quality check:** No validation that frames contain actual image data
3. **No content validation:** If frames are invalid, self-review proceeds anyway

**Impact:**
- Self-review may analyze invalid frames
- Trust evaluation based on corrupted evidence
- Silent failures in frame extraction

---

### 2.8 No Validation of Shot Plan Completeness ⚠️ MEDIUM

**Location:** `App.tsx` lines 129-136

```typescript
const plans = await generateProjectPlan(...);
const newShots: Shot[] = plans.map((p, i) => ({
  plan: p,  // ← No validation that p is a valid ShotPlan
  // ...
}));
```

**Trust Issues:**
1. **No array check:** No validation that `plans` is an array
2. **No field validation:** No check that each plan has required fields
3. **No structure validation:** No validation against `ShotPlan` interface
4. **Type safety illusion:** TypeScript types don't enforce runtime validation

**Impact:**
- Invalid shot plans can be created
- Runtime errors when accessing missing fields
- Trust evaluation on invalid data

---

## Part 3: Hardcoded Assumptions Not Documented

### 3.1 Model Choices and Versions
**Code Reality:**
- Shot plans: `gemini-3-pro-preview`
- Self-review: `gemini-3-flash-preview`
- Video generation: `veo-3.1-generate-preview`

**Requirements Gap:** No requirement specifies model choices or version constraints.

---

### 3.2 Default Generation Parameters
**Code Reality:**
- `useSeed: true, useRefImage: false, requestExplanation: true` hardcoded in `handleGenerateShot()`
- Video resolution: `720p` fixed
- Aspect ratio: `16:9` fixed
- Number of videos: `1` fixed

**Requirements Gap:** No requirement specifies default parameters or constraints.

---

### 3.3 LocalStorage Persistence
**Code Reality:**
- Projects saved to `localStorage` with key `"EVAL_PROJECT"`
- No server-side persistence
- Evidence lost if localStorage cleared

**Requirements Gap:** Assumptions mention "best-effort" persistence but don't specify localStorage or session-only storage.

---

### 3.4 Preset Test Scripts
**Code Reality:**
- Three hardcoded preset scripts:
  1. "Script 1: Continuity Drift"
  2. "Script 2: Plausible Planning Errors"
  3. "Script 3: Misleading Explanations"

**Requirements Gap:** No requirement mentions test scenarios or preset scripts.

**Trust Issue:** System designed with specific failure modes in mind, which should be documented.

---

## Part 4: Trust-Critical Requirements Not Prioritized

The code reveals implicit priorities that should be explicit in requirements:

### Critical (System Breaks Without It)
- **Evidence collection and export** - Required for evaluation
- **Artifact visibility** - Required for trust assessment  
- **Human authority** - Required for acceptance/rejection

### Important (System Functions But Trust Evaluation Compromised)
- **AI self-review accuracy** - Affects trust evaluation quality
- **Continuity mechanisms** - Expected but not implemented
- **Attempt lineage tracking** - Needed for evidence trails

### Desirable (Nice to Have)
- **Prompt revision suggestions** - Helpful but not critical
- **Validation of external videos** - Additional feature
- **Preset test scripts** - Convenience feature

---

## Part 5: Recommendations

### 5.1 Immediate Actions (Critical Trust Gaps)

1. **Add try-catch around all JSON.parse calls**
   - Proper error handling with structured error types
   - Surface errors to UI, not just console
   - Log failures for evidence collection

2. **Implement runtime validation of parsed JSON**
   - Validate against schemas after parsing
   - Check required fields and types
   - Reject invalid data with clear errors

3. **Add timeout and retry limits to video generation**
   - Maximum wait time (e.g., 5 minutes)
   - Maximum retry count (e.g., 3 attempts)
   - Clear timeout errors

4. **Implement continuity seed mechanism OR remove claim**
   - Either implement actual seed passing to API
   - Or remove continuity claims from requirements
   - Update metadata to reflect reality

5. **Validate API key before making calls**
   - Early validation with clear error messages
   - Don't proceed with empty keys

### 5.2 Short-Term Improvements (Important)

6. **Add structured error types and classification**
   - Error taxonomy: RateLimit | APIError | NetworkError | ValidationError
   - Include error codes and context
   - Log for evidence collection

7. **Validate frame sampling results**
   - Check frames contain valid image data
   - Validate frame quality before self-review
   - Reject invalid frames with errors

8. **Validate shot plans before creating shots**
   - Runtime validation against ShotPlan interface
   - Check required fields exist
   - Reject invalid plans

9. **Surface errors to UI properly**
   - Don't rely on console.log
   - User-visible error messages
   - Error state in UI

### 5.3 Long-Term Enhancements (Desirable)

10. **Log all AI API calls with request/response**
    - Full request/response logging for evidence
    - Include timestamps and model info
    - Export in evidence bundles

11. **Add metrics for failure rates by type**
    - Track failure categories
    - Aggregate statistics
    - Include in evidence export

12. **Add retry logic with exponential backoff**
    - Handle transient failures
    - Respect rate limits
    - Clear retry status in UI

---

## Part 6: Requirements Document Updates Needed

### 6.1 Add Explicit Requirements For:
- Evaluation mode and outcome coding
- AI self-review with structured rubric
- Attempt lineage and regeneration tracking
- Evidence bundle export
- Validation phase for external videos

### 6.2 Document Hardcoded Assumptions:
- Model choices and versions
- Default generation parameters
- Resolution and aspect ratio constraints
- LocalStorage persistence limitations

### 6.3 Prioritize Trust-Critical Requirements:
- Mark which requirements are Critical vs. Important vs. Desirable
- Justify prioritization based on evaluation needs

### 6.4 Clarify Continuity Mechanisms:
- Specify when seeds are used (or acknowledge they're not)
- Document how continuity is attempted vs. guaranteed
- Acknowledge implementation gaps

### 6.5 Add Discrepancy Detection Section:
- Document where AI was used in requirements elicitation
- Identify where code reveals assumptions not in requirements
- Note where requirements are more confident than implementation supports

---

## Conclusion

This reverse-engineering analysis reveals that the requirements document is **significantly incomplete** relative to the implementation. The codebase shows a system built for research/evaluation with sophisticated frontend trust mechanisms, but these are built on a backend foundation with **critical trust gaps**, particularly:

1. **Silent failure patterns** in JSON parsing and validation
2. **Non-functional features** (continuity seeds) that are claimed but not implemented
3. **Missing error handling** that obscures failures
4. **No runtime validation** despite schema definitions

The frontend trust mechanisms (outcome coding, evidence export, AI self-review) are sophisticated, but they cannot be reliable if the backend silently fails or produces invalid data. These gaps must be addressed before trust evaluation can be considered reliable.

**Priority Focus Areas:**
1. `services/gemini.ts` - All AI integration points need error handling and validation
2. `App.tsx` - Data flow validation at boundaries
3. Type safety vs. runtime validation - Need runtime checks, not just TypeScript types

---

## Appendix: Code Locations for Reference

### Critical Files
- `services/gemini.ts` - All AI service functions
- `App.tsx` - Main application logic and state management
- `types.ts` - Type definitions and interfaces

### Key Functions to Review
- `generateProjectPlan()` - Line 192
- `suggestNextShotPlan()` - Line 221
- `generateVideoAttempt()` - Line 248
- `runAISelfReview()` - Line 90
- `sampleFrames()` - Line 55
- `getCurrentApiKey()` - Line 5

---

**End of Document**
