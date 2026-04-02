# Project Progress: AI Trust Lab (ITSC 8010)

This report documents the evolution of the **UNCC 8-Second Story Movie Builder**, a research-facing prototype for AI-assisted movie production. We have transitioned from an initial "Feature Building" phase to a "Trust-Verified Instrument" phase.

## Phase 1: High-Fidelity "Boca Cola" Challenge
The project's logic was first stressed by introducing **Script 4: Boca Cola Commercial**. This scenario was added specifically to evaluate the AI's ability to maintain "Brand Safety" and "Visual Fidelity" in a highly stylized, commercial setting.

- **Objective**: Test high-energy motion, fluid dynamics (the "pour"), and neon-cyberpunk aesthetic consistency.
- **Scenario Metrics**: 4 shots, 24fps, cinematic lighting.
- **Observed Challenge**: Maintaining the specific "Boca Cola Blue" across multiple generations without a reference image (a classic "Trust Gap" the system is designed to identify).

## Phase 2: Trust Gate & Infrastructure Hardening
We implemented 18 **CI Contracts** to automatically validate the project against its own trust claims.

### Key Hardening Efforts:
1.  **Contract 14 (Mandatory Outcome Coding)**: Prevents export of incomplete evidence bundles.
2.  **Hypothesis H-M2 (Revision Lineage)**: Added the "Apply Revision" flow to close the causal gap between AI self-review suggestions and human acceptance.
3.  **Hypothesis H-H2 (Calibration Stability)**: Integrated a **Calibration Guide** to reduce human subjectivity in trust labeling.

## Phase 3: Evaluation & Validation (Current State)
We have initialized the **FLAG Incident Log** to track all observed deviations during class evaluation sessions.

- **Baseline Status**: All 18 baseline trust contracts PASSED.
- **Stress Status**: Successfully caught a code-level "Trust Perimeter" bypass using the `inject-fault.mjs` stress-test.

---
*Created on 2026-04-02 for ITSC 8010 Class Project.*
