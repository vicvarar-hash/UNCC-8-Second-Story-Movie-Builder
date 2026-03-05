import path from "path";
import fs from "fs";

import c01 from "../contracts/01_presets.mjs";
import c02 from "../contracts/02_phases.mjs";
import c03 from "../contracts/03_types_lineage.mjs";
import c04 from "../contracts/04_attempts_append_only.mjs";
import c05 from "../contracts/05_export_bundle.mjs";
import c06 from "../contracts/06_api_key.mjs";
import c07 from "../contracts/07_safe_json_parse.mjs";
import c08 from "../contracts/08_video_timeout.mjs";
import c09 from "../contracts/09_plan_structure_validation.mjs";
import c10 from "../contracts/10_no_generate_without_acceptance.mjs";
import c11 from "../contracts/11_project_context_persistence_multimodal.mjs";
import c12 from "../contracts/12_rubric_completeness.mjs";
import c13 from "../contracts/13_evidence_export_completeness.mjs";
import c14 from "../contracts/14_mandatory_outcome_coding_before_export.mjs";
import c15 from "../contracts/15_frame_sampling_quality.mjs";
import c16 from "../contracts/16_error_classification.mjs";
import c17 from "../contracts/17_trust_calibration_guidance.mjs";
import c18 from "../contracts/18_continuity_metadata_honesty.mjs";

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

const ctx = {
  appDir: process.env.APP_DIR || ".",
  appFile: process.env.APP_FILE || "App.tsx",
  typesFile: process.env.TYPES_FILE || "types.ts",
  readText,
  pathJoin: path.join,
};

const contracts = [
  { id: "01", name: "Plan preset scripts (SCRIPTS keys + shape)", run: c01 },
  { id: "02", name: "Phase model union (plan/produce/validate/export)", run: c02 },
  { id: "03", name: "Types: lineage + acceptance fields exist", run: c03 },
  { id: "04", name: "Attempts are append-only (no overwrite)", run: c04 },
  { id: "05", name: "Evidence bundle export exists", run: c05 },
  { id: "06", name: "API key validation (trust gate, TR6)", run: c06 },
  { id: "07", name: "Safe JSON parse with error surfacing", run: c07 },
  { id: "08", name: "Video generation timeout (TR7)", run: c08 },
  { id: "09", name: "Plan structure validation before shots", run: c09 },
  { id: "10", name: "No video generation without explicit acceptance", run: c10 },
  { id: "11", name: "Expanded project context persists + reaches planning/generation/review", run: c11 },
  { id: "12", name: "Rubric completeness check before use", run: c12 },
  { id: "13", name: "Evidence export completeness", run: c13 },
  { id: "14", name: "Mandatory outcome coding before export", run: c14 },
  { id: "15", name: "Frame sampling quality check", run: c15 },
  { id: "16", name: "Error classification for trust analysis", run: c16 },
  { id: "17", name: "Trust calibration guidance", run: c17 },
  { id: "18", name: "Continuity metadata honesty", run: c18 },
];

let failures = 0;
const failureMessages = [];

for (const c of contracts) {
  try {
    await c.run(ctx);
    console.log(`✅ [${c.id}] ${c.name}`);
  } catch (e) {
    failures += 1;
    const msg = `❌ [${c.id}] ${c.name}\n   ${String(e?.message || e)}`;
    console.error(msg);
    failureMessages.push(msg);
  }
}

if (failures > 0) {
  console.error(`\n🚫 Contract suite failed: ${failures} failing contract(s).`);
  process.exit(1);
}

console.log("\n🎉 All contracts passed.");

