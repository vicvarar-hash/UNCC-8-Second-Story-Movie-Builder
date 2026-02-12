# Scope Assessment: Critical Findings for L3/L4

**Question:** Are the critical assessment findings within scope of L3 (Requirements Elicitation) and L4 (Requirements Validation and Trust Hypotheses)?

---

## L3 Scope: AI-Based Requirements Elicitation

### What L3 Expects:
1. **Use AI to elicit/refine requirements** - Identify where AI was used
2. **Detect discrepancies** - Compare AI-generated requirements with team understanding
3. **Identify assumptions** - Where assumptions are made implicitly
4. **Identify ambiguities** - Where requirements appear more confident than justified
5. **Trust-critical requirements** - Classify must-hold, may-fail, unguaranteed

### What L3 Does NOT Expect:
- Detailed implementation fixes
- Code-level technical solutions
- Deep dive into error handling implementation

---

## L4 Scope: Requirements Validation and Trust Hypotheses

### What L4 Expects (from slide deck):
1. **Revisit Requirements v1** - Challenge and refine
2. **Challenge AI-influenced requirements** - Identify contradictions
3. **Identify assumptions** - Make implicit assumptions explicit
4. **Classify requirements** - Must-hold, may-fail, not guaranteed
5. **Write trust hypotheses** - Explicit, scoped, falsifiable claims
6. **Record AI involvement** - Prompts, suggestions, rejected outputs

### Key L4 Questions (from slides):
- "What is AI assuming?" (Slide 5)
- "What behavior is AI inventing?" (Slide 5)
- "What failures would go unnoticed?" (Slide 5)
- "Are requirements internally consistent?" (Slide 4)
- "Are they observable?" (Slide 4)
- "Are they testable in principle?" (Slide 4)
- "Do we understand what happens when they fail?" (Slide 4)

### What L4 Does NOT Expect:
- Implementation of fixes (belongs to design/implementation phases)
- Detailed technical solutions (belongs to design phase)
- Code refactoring (belongs to later phases)

---

## Assessment: What's IN Scope for L3/L4

### ✅ **IN SCOPE - Requirements-Level Findings**

#### 1. Missing Requirements (Part 1 of findings)
**Status:** ✅ **IN SCOPE for L3/L4**

**Why:**
- Identifies discrepancies between requirements and actual system behavior
- Documents assumptions that should be explicit in requirements
- Aligns with L3: "identify where assumptions are made implicitly"
- Aligns with L4: "identify contradictions"

**Examples:**
- Evaluation mode not in requirements → Assumption that should be explicit
- Outcome coding not in requirements → Missing requirement
- Evidence bundle export not in requirements → Missing requirement

**Action for L3/L4:**
- Add these as requirements or document as assumptions
- Classify as must-hold, may-fail, or not guaranteed

---

#### 2. Contradictions Between Requirements and Implementation
**Status:** ✅ **IN SCOPE for L4**

**Why:**
- L4 explicitly asks: "Are requirements internally consistent?"
- L4 asks: "Challenge AI-influenced requirements"
- Identifies where requirements claim functionality that doesn't exist

**Key Finding:**
- **FR4 claims continuity support** ("may optionally provide reference images and the final frame of the previous shot")
- **But code shows continuity seed is NOT implemented** (parameter exists but never used)

**Action for L4:**
- Document this contradiction
- Either update requirement to reflect reality OR add requirement to implement it
- Classify as trust hypothesis: "Continuity mechanisms may fail because they are not implemented"

---

#### 3. Hardcoded Assumptions Not Documented
**Status:** ✅ **IN SCOPE for L3/L4**

**Why:**
- L3: "identify where assumptions are made implicitly"
- L4: "identify assumptions" and "make assumptions visible"
- These are requirements-level assumptions, not implementation details

**Examples:**
- Model choices (gemini-3-pro-preview, veo-3.1-generate-preview)
- Default parameters (720p, 16:9, useSeed: true)
- LocalStorage persistence

**Action for L3/L4:**
- Document these as assumptions in requirements
- Note that they may need to be requirements or configuration options

---

#### 4. Trust-Critical Requirements Not Prioritized
**Status:** ✅ **IN SCOPE for L4**

**Why:**
- L4 explicitly requires: "Classify requirements into: must-hold, may-fail, not guaranteed"
- L3 requires: "identify requirements whose failure would be unacceptable"
- This is exactly what L4 expects

**Action for L4:**
- Classify each requirement as:
  - **Must-hold** (violations are unacceptable)
  - **May-fail** (failures are tolerated but monitored)
  - **Not guaranteed** (explicitly outside trust scope)

---

#### 5. Silent Failures That Would Go Unnoticed
**Status:** ✅ **IN SCOPE for L4**

**Why:**
- L4 slide 5 asks: "What failures would go unnoticed?"
- This is a core L4 question
- Identifies trust gaps that should be trust hypotheses

**Key Findings:**
- JSON parsing failures return empty objects silently
- Invalid AI responses accepted without validation
- Errors logged only to console (not observable)

**Action for L4:**
- Create trust hypotheses about these failure modes:
  - "The system may accept invalid AI responses without surfacing errors"
  - "JSON parsing failures may result in empty data structures being treated as valid"
- Classify observability requirements as must-hold

---

#### 6. AI Assumptions and Behavior
**Status:** ✅ **IN SCOPE for L3/L4**

**Why:**
- L4 slide 5: "What is AI assuming?" and "What behavior is AI inventing?"
- L3: "identify where AI output introduces ambiguity"
- Identifies where AI behavior differs from requirements

**Key Findings:**
- AI may return invalid JSON that gets silently accepted
- AI may violate schema but system doesn't validate
- AI self-review may fail but return empty rubric

**Action for L3/L4:**
- Document these as trust hypotheses
- Note that AI behavior may not match requirements
- Classify as "may-fail" or "not guaranteed"

---

## Assessment: What's OUT OF SCOPE for L3/L4

### ❌ **OUT OF SCOPE - Implementation-Level Details**

#### 1. Specific Code Fixes
**Status:** ❌ **OUT OF SCOPE**

**Why:**
- These belong to design/implementation phases
- L3/L4 are about requirements, not implementation

**Examples:**
- "Add try-catch around JSON.parse"
- "Implement timeout in polling loop"
- "Add runtime validation functions"

**What to Do Instead:**
- Convert to requirements or trust hypotheses:
  - "The system MUST validate AI responses before use"
  - "The system MUST surface errors to users, not just console"
  - "The system MUST have timeout mechanisms for long-running operations"

---

#### 2. Technical Implementation Details
**Status:** ❌ **OUT OF SCOPE**

**Why:**
- These are design decisions, not requirements
- Belongs to later design phase

**Examples:**
- Specific error handling patterns
- Retry logic implementation
- Logging infrastructure

**What to Do Instead:**
- Document as requirements:
  - "The system MUST handle API failures gracefully"
  - "The system MUST log all AI interactions for evidence"
- Let design phase decide HOW to implement

---

## Recommended Focus for L3/L4

### ✅ **DO Focus On:**

1. **Requirements Contradictions**
   - FR4 claims continuity but it's not implemented
   - Document this as a contradiction
   - Create trust hypothesis: "Continuity mechanisms may fail because implementation is incomplete"

2. **Missing Requirements**
   - Evaluation mode, outcome coding, evidence export
   - Add as requirements OR document as assumptions
   - Classify trust-criticality

3. **Silent Failure Modes**
   - JSON parsing failures
   - Invalid AI responses accepted
   - Errors not surfaced
   - Create trust hypotheses about these

4. **AI Assumptions**
   - AI may return invalid data
   - System may accept invalid AI responses
   - Document as trust hypotheses

5. **Trust-Critical Classification**
   - Classify all requirements as must-hold, may-fail, or not guaranteed
   - Justify classifications

6. **Observability Requirements**
   - "What failures would go unnoticed?" → Requirements about error visibility
   - "Are they observable?" → Requirements about making failures visible

---

### ❌ **DON'T Focus On (Yet):**

1. **Specific code fixes** - Save for design/implementation
2. **Technical solutions** - Save for design phase
3. **Implementation patterns** - Save for design phase

---

## Revised Findings Document Structure for L3/L4

### Part 1: Requirements Contradictions (L4)
- FR4 claims continuity but not implemented
- Requirements claim features that don't exist
- Requirements missing features that exist

### Part 2: Missing Requirements (L3/L4)
- Evaluation mode, outcome coding, evidence export
- Document as requirements or assumptions
- Classify trust-criticality

### Part 3: Silent Failure Modes → Trust Hypotheses (L4)
- Convert findings to trust hypotheses:
  - "The system may accept invalid AI responses without validation"
  - "JSON parsing failures may result in empty data structures"
  - "Errors may be logged but not surfaced to users"

### Part 4: AI Assumptions (L3/L4)
- "What is AI assuming?" → AI assumes responses are valid
- "What behavior is AI inventing?" → AI invents data structures when JSON fails
- Document as trust hypotheses

### Part 5: Trust-Critical Classification (L4)
- Classify all requirements
- Justify classifications

---

## Conclusion

**Most findings ARE in scope**, but need to be **reframed as requirements-level concerns** rather than implementation fixes:

- ✅ **Requirements contradictions** → L4
- ✅ **Missing requirements** → L3/L4
- ✅ **Silent failures** → Trust hypotheses for L4
- ✅ **AI assumptions** → L3/L4
- ✅ **Trust-critical classification** → L4
- ❌ **Code fixes** → Later phases
- ❌ **Technical solutions** → Design phase

The key is to **convert implementation findings into requirements statements and trust hypotheses** rather than proposing code fixes.

---

**Next Steps:**
1. Reframe backend trust gaps as trust hypotheses
2. Document requirements contradictions
3. Classify trust-critical requirements
4. Create observability requirements from silent failure findings
