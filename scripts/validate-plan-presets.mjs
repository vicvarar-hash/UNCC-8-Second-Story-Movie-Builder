import fs from "fs";

const FILE = "App.tsx"; // adjust if your App lives elsewhere

const required = [
  // Plan stage contract
  "phase === 'plan'",
  "Load Preset Script",

  // Required presets
  "Script 1: Continuity Drift",
  "Script 2: Plausible Planning Errors",
  "Script 3: Misleading Explanations",
];

if (!fs.existsSync(FILE)) {
  console.error(`❌ Missing ${FILE}. If your file is in /src, update FILE to "src/App.tsx".`);
  process.exit(2);
}

const text = fs.readFileSync(FILE, "utf8");

const missing = required.filter((s) => !text.includes(s));

if (missing.length) {
  console.error("❌ Plan preset contract failed. Missing:");
  for (const m of missing) console.error(` - ${m}`);
  process.exit(1);
}

console.log("✅ Plan preset contract passed.");
