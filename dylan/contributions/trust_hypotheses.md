# Trust Hypotheses Inventory

_Date:_ January 28, 2026
_Context:_ Derived directly from the implemented prototype (App.tsx, services/gemini.ts, types.ts) to make the system’s implicit trust assumptions explicit before writing new requirements or tests.

---

## 1. Scenario-Level Hypotheses (Preset Scripts)

These live in `App.tsx` under the three built-in scripts that can be loaded during the planning phase.

| Hypothesis ID | Scenario                      | What is being stressed                                          | Evidence in code                                                   | Notes / Risks                                                                                         |
| ------------- | ----------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| H-S1          | “Continuity Drift”          | Model will drift from wardrobe/props across shots unless seeded | `App.tsx` SCRIPTS entry enables `defaults: { useSeed: true }`  | Backend never uses `useSeed`, so this hypothesis is currently untestable, causing false confidence. |
| H-S2          | “Plausible Planning Errors” | Even with a calm scene, planning JSON may omit key controls     | `App.tsx` SCRIPTS entry with defaults disabling seed/explanation | No validation on returned plan → silent schema drift undermines the hypothesis.                      |
| H-S3          | “Misleading Explanations”   | Asking for explanations may create hallucinated justifications  | `App.tsx` SCRIPTS entry setting `requestExplanation: true`     | Explanations are concatenated into prompts but never parsed, so the hypothesis cannot be inspected.   |

---

## 2. Generation & Continuity Hypotheses

| Hypothesis ID | Statement                                                                 | Supporting Implementation                                                             | Observed Gap                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| H-G1          | Setting `useSeed: true` will improve continuity                         | `handleGenerateShot` always passes `{ useSeed: true }` (App.tsx)                  | `generateVideoAttempt` records `useSeed` in metadata but never forwards a seed or `previousVideoUrl` to Veo, so the hypothesis is unimplemented. |
| H-G2          | Passing prior frames (`previousVideoUrl`) should stabilize regeneration | `generateVideoAttempt` signature includes `previousVideoUrl` (services/gemini.ts) | Parameter unused; any study of continuity is impossible until implemented.                                                                             |
| H-G3          | Requesting technical explanations improves future prompts                 | `requestExplanation: true` flag appended to prompt (App.tsx)                        | Explanations are never parsed/store. Hypothesis cannot be evaluated, yet UI implies it is.                                                             |

---

## 3. Measurement & Self-Review Hypotheses

| Hypothesis ID | Statement                                                                | Evidence in Code                                                                                | Concerns                                                                                                         |
| ------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| H-M1          | Gemini can score Narrative/Visual/Continuity/Physics dimensions reliably | `runAISelfReview` prompt + `SelfReviewRubric` schema (`services/gemini.ts`, `types.ts`) | JSON parse is unchecked; invalid rubrics silently become `{}`.                                                 |
| H-M2          | Prompt revisions suggested by AI meaningfully improve later attempts     | `promptRevision` block stored in attempts and Copy button in UI                               | No link between accepted revision and next generation; manual copy is required, so hypothesis is manual at best. |
| H-M3          | Validation tab can evaluate third-party clips/movies                     | `validationReviews` state + `runAISelfReview` reuse (App.tsx)                               | Frame sampling lacks quality checks; hypothesis depends on unverified frames.                                    |

---

## 4. Evidence & Trace Hypotheses

| Hypothesis ID | Statement                                                  | Code Anchor                                                              | Risk                                                                                      |
| ------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| H-E1          | Outcome taxonomy captures real failure types               | `Outcome` interface (`types.ts`) and Outcome Coding UI (`App.tsx`) | No backend storage/export verification yet; relies on localStorage only.                  |
| H-E2          | Attempt lineage preserves causal history                   | `GenerationAttempt` (`types.ts`) + lineage UI                        | Works only if every attempt succeeded; error attempts keep minimal context.               |
| H-E3          | Evidence bundle export yields a complete research artifact | `exportBundle()` serializes `project` tree (App.tsx)                 | Missing API request/response logs or generation errors, so export is incomplete evidence. |
| H-E4          | Validation reviews provide independent evidence            | `validationReviews` array appended after self-review on uploads        | Same silent JSON/frames issues mean evidence may be empty while UI shows success.         |

---

## 5. Human Oversight & Trust Calibration Hypotheses

| Hypothesis ID | Statement                                                           | Implementation                                          | Challenge                                                                |
| ------------- | ------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------ |
| H-H1          | Human operators remain final authority (“evaluation mode”)        | `evaluationMode: true` default in project seed        | No UI path to disable; assumption is hardcoded rather than enforced.     |
| H-H2          | Trust calibration (Under/Calibrated/Over) can be reliably annotated | Dropdowns in Outcome UI + taxonomy in `types.ts`      | No guidance or automation; purely subjective without prompts/examples.   |
| H-H3          | Local-only persistence is sufficient for evidence gathering         | Project stored in `localStorage` key `EVAL_PROJECT` | Clearing cache erases all evidence, contradicting research trace claims. |

---

## 6. What to Do Next

1. **Decide which unimplemented hypotheses get dropped vs. built.** The continuity and explanation hypotheses currently produce misleading metadata—either wire them up or flag them as unsupported.
2. **Add runtime validation** for every hypothesis that depends on AI JSON (plans, rubrics, prompt revisions). Without validation, we cannot tell whether the hypothesis passed or the parser simply returned `{}`.
3. **Instrument evidence collection** (API request/response IDs, error taxonomy) so that exports actually prove or falsify the hypotheses.
4. **Document each hypothesis** in the formal requirements document so evaluators know which trust questions the prototype is attempting to answer.

This inventory should serve as the bridge between the existing prototype and the upcoming trust analysis/requirements updates.
