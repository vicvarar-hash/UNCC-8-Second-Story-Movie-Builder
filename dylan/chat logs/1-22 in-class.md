# Folder contents review
_Exported on 1/22/2026 at 18:15:53 EST from Cursor (2.4.7)_

---

**User**

take a look at teh contents of this folder and get acclimated, we'll begin analusis soon

---

**Cursor**


Reviewing key files to understand the project structure and contents.



Reviewing additional files to complete the overview:



Checking for other files in subdirectories:



## Project overview

**8-Second Story Movie Builder** — AI-powered video generation tool for research/evaluation.

### Architecture
- Frontend: React + TypeScript + Vite, Tailwind CSS
- Backend: Google GenAI SDK integration (`services/gemini.ts`)
- Models:
  - `gemini-3-pro-preview` — shot planning
  - `gemini-3-flash-preview` — AI self-review
  - `veo-3.1-generate-preview` — video generation

### Workflow phases
1. Plan — Generate shot plans from story outline
2. Produce — Generate videos per shot with regeneration tracking
3. Validate — Review external videos (clips/movies)
4. Export — Export evidence bundles (JSON)

### Trust evaluation features
- Outcome coding: failure types, visibility, trust calibration, correction effort
- AI self-review: structured rubric (1–5 scores) with prompt revision suggestions
- Attempt lineage: tracks regeneration history with `promptSource` and `parentAttemptId`
- Evidence export: full project trace for research

### Critical findings (from your assessment)
- Frontend has robust trust mechanisms
- Backend has silent failure patterns:
  - JSON parsing without try-catch
  - No runtime schema validation
  - Continuity seed mechanism not implemented (parameter exists but unused)
  - Infinite polling loops with no timeout
  - Error handling that loses context

### Project structure
- Main app: `App.tsx` (835 lines)
- Services: `services/gemini.ts` (AI integration)
- Types: `types.ts` (TypeScript interfaces)
- Components: `Spinner.tsx`
- Assessment: `dylan/contributioins/1-22_critical_assessment_findings.md`

Ready for analysis. What should we focus on first?

