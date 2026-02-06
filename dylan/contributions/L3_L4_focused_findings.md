# L3/L4 Focused Findings: Requirements Validation and Trust Hypotheses

**Purpose:** Reframe critical assessment findings as requirements-level concerns for L3 (Requirements Elicitation) and L4 (Requirements Validation and Trust Hypotheses)

---

## Part 1: Requirements Contradictions (L4 Focus)

### Contradiction 1: Continuity Mechanism Claimed But Not Implemented

**Requirement (FR4):**
> "The system may optionally provide reference images and the final frame of the previous shot to encourage continuity."

**Reality (from codebase):**
- `previousVideoUrl` parameter exists but is never used
- `useSeed` option recorded in metadata but seed never passed to API
- Continuity mechanism is non-functional

**L4 Action Required:**
1. **Document contradiction** in requirements validation
2. **Create trust hypothesis:**
   - "Continuity mechanisms may fail because implementation is incomplete. The system records continuity attempts in metadata but does not actually pass continuity data to the video generation API."
3. **Classify requirement:**
   - Current: Implied as "may-fail"
   - Should be: Explicitly "not guaranteed" OR add requirement to implement

**Trust Hypothesis:**
> "The system cannot guarantee continuity across shots because continuity mechanisms (seed frames, reference images) are not implemented despite being claimed in requirements."

---

### Contradiction 2: Requirements Claim Observability But Errors Are Hidden

**Requirement (TR5, FR7):**
> "The system should clearly indicate where generative AI has influenced system behavior"  
> "The system should make intermediate artifacts visible"

**Reality (from codebase):**
- Errors logged only to `console.error()` (not visible in production)
- JSON parsing failures return empty objects silently
- Invalid AI responses accepted without user notification

**L4 Action Required:**
1. **Document contradiction** - Observability claimed but not fully implemented
2. **Create trust hypothesis:**
   - "Error visibility may be incomplete. Some failures (JSON parsing, invalid responses) may occur without user notification."
3. **Strengthen requirement:**
   - Change "should" to "MUST" for error visibility
   - Specify that errors must be surfaced to UI, not just console

**Trust Hypothesis:**
> "The system may fail silently in cases where AI responses are invalid or malformed, despite requirements claiming full artifact visibility."

---

## Part 2: Missing Requirements (L3/L4 Focus)

### Missing Requirement 1: Evaluation Mode and Outcome Coding

**What Exists in Code:**
- `evaluationMode: true` hardcoded
- Structured `Outcome` interface with failure classification
- Human outcome coding UI

**L3/L4 Action Required:**
1. **Add as requirement OR document as assumption:**
   - Option A: Add requirement: "The system MUST support evaluation mode with structured outcome coding"
   - Option B: Document as assumption: "System operates in evaluation mode for research purposes"
2. **Classify trust-criticality:**
   - If requirement: Must-hold (needed for trust evaluation)
   - If assumption: Document that it affects all other requirements

**Trust Hypothesis:**
> "The system operates in evaluation mode, which affects how all other requirements should be interpreted. Evidence collection and outcome coding are primary functions, not secondary features."

---

### Missing Requirement 2: Evidence Bundle Export

**What Exists in Code:**
- Full project export as JSON
- Includes all artifacts, attempts, outcomes, reviews

**L3/L4 Action Required:**
1. **Add requirement:**
   - "The system MUST export complete evidence bundles containing all artifacts, attempts, lineage, outcomes, and AI reviews for trust evaluation."
2. **Classify:** Must-hold (required for trust evaluation)

**Trust Hypothesis:**
> "Evidence bundles must be complete and accurate. Missing or corrupted evidence invalidates trust evaluation."

---

### Missing Requirement 3: AI Self-Review with Structured Rubric

**What Exists in Code:**
- Structured rubric with scores (1-5) for multiple dimensions
- Optional prompt revision suggestions
- Recursive AI usage (AI reviewing AI)

**L3/L4 Action Required:**
1. **Add requirement:**
   - "The system MUST provide AI self-review with structured rubric scoring and optional prompt revision suggestions."
2. **Document trust dependency:**
   - "AI self-review creates recursive trust dependency (AI evaluating AI). Self-review outputs are fallible and should be treated as evidence, not authoritative."
3. **Classify:** May-fail (self-review may be incorrect)

**Trust Hypothesis:**
> "AI self-review outputs are fallible. The system uses AI to evaluate AI-generated content, creating a recursive trust dependency. Self-review scores and suggestions should be treated as evidence, not guarantees."

---

## Part 3: Silent Failure Modes → Trust Hypotheses (L4 Focus)

### Trust Hypothesis 1: Invalid AI Responses May Be Accepted

**Finding:**
- JSON parsing uses fallback to empty objects: `JSON.parse(response.text || '{}')`
- No validation that parsed JSON matches expected structure
- No error surfaced if JSON is malformed

**L4 Trust Hypothesis:**
> "The system may accept invalid or malformed AI responses without validation. JSON parsing failures may result in empty data structures being treated as valid, leading to silent failures in shot plan generation, self-review, and other AI-dependent operations."

**Classification:** May-fail (failures are tolerated but should be monitored)

**Observability Requirement:**
> "The system MUST surface JSON parsing failures and invalid AI responses to users, not just console logs."

---

### Trust Hypothesis 2: AI Response Validation Is Not Guaranteed

**Finding:**
- `responseSchema` in API config doesn't guarantee runtime compliance
- No runtime validation of parsed JSON against schemas
- TypeScript types provide compile-time safety but no runtime protection

**L4 Trust Hypothesis:**
> "The system cannot guarantee that AI responses match expected schemas. Even with schema enforcement in API configuration, runtime validation is not performed. Invalid responses may propagate through the system."

**Classification:** Not guaranteed (explicitly outside trust scope)

**Observability Requirement:**
> "The system MUST validate AI responses at runtime and reject invalid responses with clear error messages."

---

### Trust Hypothesis 3: Video Generation May Hang Indefinitely

**Finding:**
- Polling loop has no timeout: `while (!operation.done) { ... }`
- No maximum retry count
- No error handling for stuck operations

**L4 Trust Hypothesis:**
> "Video generation operations may hang indefinitely if the API operation never completes. The system has no timeout mechanism, which may result in browser tabs hanging and resource waste."

**Classification:** May-fail (should be monitored and prevented)

**Requirement:**
> "The system MUST implement timeout mechanisms for long-running AI operations (e.g., video generation). Maximum wait time and retry limits must be defined."

---

### Trust Hypothesis 4: Frame Sampling May Produce Invalid Inputs

**Finding:**
- No validation that frames were successfully extracted
- No check that frames contain actual image data
- Invalid frames may be passed to self-review

**L4 Trust Hypothesis:**
> "Frame sampling for AI self-review may produce invalid or empty frames. The system does not validate frame quality before passing to self-review, which may result in corrupted evidence."

**Classification:** May-fail (should be validated)

**Requirement:**
> "The system MUST validate frame sampling results before passing to AI self-review."

---

## Part 4: AI Assumptions (L3/L4 Focus)

### Assumption 1: AI Responses Are Always Valid JSON

**L4 Question:** "What is AI assuming?"

**Finding:**
- Code assumes `response.text` is always valid JSON
- Fallback to empty objects suggests awareness of potential failure, but doesn't handle it properly

**L4 Trust Hypothesis:**
> "The system assumes AI responses are always valid JSON. When this assumption fails, the system falls back to empty objects, which may be treated as valid data."

**Action:**
- Document as assumption in requirements
- Create requirement: "The system MUST handle invalid AI responses gracefully"

---

### Assumption 2: AI Schema Compliance Is Guaranteed

**L4 Question:** "What behavior is AI inventing?"

**Finding:**
- System trusts that `responseSchema` in API config guarantees compliance
- No runtime validation performed

**L4 Trust Hypothesis:**
> "The system assumes AI responses always comply with specified schemas. When AI invents fields or violates schemas, the system may accept invalid data without detection."

**Action:**
- Document that schema enforcement is not guaranteed
- Create requirement for runtime validation

---

### Assumption 3: API Operations Always Complete

**L4 Question:** "What failures would go unnoticed?"

**Finding:**
- Polling loop assumes operations always complete
- No handling for operations that never finish

**L4 Trust Hypothesis:**
> "The system assumes video generation operations always complete. Operations that never finish may cause the system to hang indefinitely without user notification."

**Action:**
- Document as assumption
- Create requirement for timeout mechanisms

---

## Part 5: Trust-Critical Classification (L4 Focus)

### Must-Hold Requirements (Violations Are Unacceptable)

1. **Evidence Collection and Export** (Missing requirement)
   - Failure = Cannot evaluate trust
   - Must be implemented and reliable

2. **Error Visibility** (Enhanced from TR5/FR7)
   - Failure = Silent failures undermine trust evaluation
   - Errors must be surfaced to UI

3. **Human Authority** (TR4)
   - Failure = System overrides user decisions
   - Must be enforced

4. **Artifact Visibility** (FR7)
   - Failure = Cannot inspect AI outputs
   - Must be observable

---

### May-Fail Requirements (Failures Are Tolerated But Monitored)

1. **Continuity Across Shots** (TR2, FR4)
   - Failure = Expected, but should be monitored
   - Current: Not even implemented, so definitely may-fail

2. **AI Response Validity** (New requirement needed)
   - Failure = AI may return invalid data
   - Should be monitored and logged

3. **Video Generation Completion** (FR4)
   - Failure = Operations may hang or fail
   - Should have timeout and retry mechanisms

4. **AI Self-Review Accuracy** (New requirement)
   - Failure = Self-review may be incorrect
   - Should be treated as evidence, not guarantee

---

### Not Guaranteed Requirements (Explicitly Outside Trust Scope)

1. **AI Response Schema Compliance** (New requirement)
   - Cannot guarantee AI follows schemas
   - Must validate at runtime

2. **JSON Parsing Success** (Implicit assumption)
   - Cannot guarantee AI returns valid JSON
   - Must handle failures gracefully

3. **Frame Sampling Quality** (Implicit assumption)
   - Cannot guarantee frames are valid
   - Must validate before use

---

## Part 6: Observability Requirements (L4 Focus)

### L4 Question: "Are they observable?"

**Current State:**
- Some errors logged to console only
- JSON parsing failures silent
- Invalid responses accepted without notification

**New Requirements Needed:**

1. **Error Visibility Requirement:**
   > "The system MUST surface all errors to the user interface, not just console logs. Errors must be visible, actionable, and logged for evidence collection."

2. **Validation Failure Visibility:**
   > "The system MUST notify users when AI responses fail validation. Invalid JSON, schema violations, and missing required fields must be surfaced with clear error messages."

3. **Operation Status Visibility:**
   > "The system MUST provide status updates for long-running operations. Timeout warnings and retry attempts must be visible to users."

4. **Evidence Completeness:**
   > "The system MUST log all AI interactions (requests, responses, errors) for evidence collection. Evidence bundles must include complete interaction logs."

---

## Summary: L3/L4 Deliverables

### For L3 (Requirements Elicitation):
1. ✅ Document missing requirements (evaluation mode, evidence export, self-review)
2. ✅ Document assumptions (model choices, default parameters, localStorage)
3. ✅ Identify where AI assumptions are made (JSON validity, schema compliance)

### For L4 (Requirements Validation):
1. ✅ Document contradictions (continuity claimed but not implemented)
2. ✅ Create trust hypotheses from silent failure findings
3. ✅ Classify requirements (must-hold, may-fail, not guaranteed)
4. ✅ Add observability requirements
5. ✅ Document AI assumptions and behavior

### NOT for L3/L4:
- ❌ Specific code fixes (save for design/implementation)
- ❌ Technical solutions (save for design phase)
- ❌ Implementation patterns (save for design phase)

---

**Key Insight:** The backend trust gaps are **requirements problems**, not just implementation problems. They reveal:
- Missing requirements (error visibility, validation)
- Contradictions (observability claimed but not implemented)
- Unstated assumptions (AI responses are always valid)
- Trust hypotheses needed (silent failures, invalid responses)

These are exactly what L3/L4 are designed to surface!
