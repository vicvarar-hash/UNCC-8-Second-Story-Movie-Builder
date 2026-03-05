export default async function contract01(ctx) {
  const appPath = ctx.pathJoin(ctx.appDir, ctx.appFile);
  const text = ctx.readText(appPath);

  // Capture SCRIPTS object block
  const scriptsBlockMatch = text.match(/const\s+SCRIPTS\s*=\s*\{([\s\S]*?)\n\};/);
  if (!scriptsBlockMatch) {
    throw new Error(`Could not find "const SCRIPTS = { ... };" in ${ctx.appFile}`);
  }

  const block = scriptsBlockMatch[1];

  const requiredKeys = [
    "Script 1: Continuity Drift",
    "Script 2: Plausible Planning Errors",
    "Script 3: Misleading Explanations",
  ];

  for (const key of requiredKeys) {
    const keyRegex = new RegExp(`["'\`]${escapeRegex(key)}["'\`]\\s*:\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, "m");
    const m = block.match(keyRegex);
    if (!m) {
      throw new Error(`Missing preset key in SCRIPTS: "${key}"`);
    }

    const presetBody = m[1];

    // Required fields inside each preset
    const requiredFields = ["outline:", "style:", "numShots:", "defaults:"];
    for (const f of requiredFields) {
      if (!presetBody.includes(f)) {
        throw new Error(`Preset "${key}" missing required field "${f.trim()}"`);
      }
    }

    // Defaults must contain these toggles (based on your current code)
    const defaultsMustHave = ["useSeed", "requestExplanation"];
    for (const d of defaultsMustHave) {
      if (!presetBody.includes(d)) {
        throw new Error(`Preset "${key}" defaults missing "${d}"`);
      }
    }
  }
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
