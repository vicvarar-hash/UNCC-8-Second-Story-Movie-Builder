# Trust Lab: Evaluation Incident Log

This document serves as the official research record for the **UNCC 8-Second Story Movie Builder** evaluation. It tracks "Incidents"—deviations from trust claims, trust gate stresses, and observed AI/Human calibration anomalies.

---

## Evaluation Template

| Field | Description |
| :--- | :--- |
| **Observation ID** | `FLAG-YYYYMMDD-NN` |
| **Timestamp** | ISO 8601 |
| **Source** | Scenario ID (e.g., Script 4) or Automated Fault |
| **Trust Gate(s)** | Which contracts/gates are being stressed? |
| **Behavior Observed** | Detailed description of the deviation or success. |
| **Gate Status** | `CAUGHT` / `SURVIVED` (Failure bypassed gate) |
| **Calibration** | Under-trust / Calibrated / Over-trust |
| **Research Note** | Interpretation of why this happened. |

---

## Observations List

### FLAG-20260330-01: Scenario Addition (Script 4 - Boca Cola)
- **Timestamp:** 2026-03-30T10:00:00-04:00 (Retroactive)
- **Source:** Scenario Introduction
- **Trust Gate(s):** Contract 09 (Plan Structure Validation), 11 (Project Context Persistence)
- **Behavior Observed:** Added a high-fidelity beverage commercial scenario to test Gemini 3's planning logic and Veo 3's fluid dynamics. The script involves complex "pop and pour" mechanics which are known failure points for temporal consistency in AI video.
- **Gate Status:** **PASSED** (Structural validation confirmed)
- **Calibration:** N/A (Baseline scenario)
- **Research Note:** This scenario is intended as a "Stress Test" for brand consistency. Initial runs (documented in truncated history) showed drift in the specific blue/cyan branding, confirming the need for multimodal reference images (H-M1).

### FLAG-20260402-01: Baseline Context & Initial Stress Test
- **Timestamp:** 2026-04-02T17:55:00-04:00
- **Source:** Automated Baseline (Contract Suite) + Fault Injection (Script: `inject-fault.mjs`)
- **Trust Gate(s):** Contract 06 (API Key Validation), Contract 14 (Export Gate), Contract 18 (Metadata Honesty)
- **Behavior Observed:** 
    - **Baseline:** System starts with all 18 trust contracts PASSED. High system health verified.
    - **Stress Test:** Injected code-level mutation (`key.length < 10` → `key.length > 10`) to bypass the API Key Trust Gate.
- **Gate Status:** **CAUGHT** (Fault detected, Contract 06 failed as expected)
- **Calibration:** Calibrated (Automated detection accurate)
- **Research Note:** Initializing the log to document the transition from feature-complete to evaluation-ready. The system successfully caught a code-level bypass of the API Key gate, proving that the CI Contracts are acting as an effective "Trust Perimeter."
