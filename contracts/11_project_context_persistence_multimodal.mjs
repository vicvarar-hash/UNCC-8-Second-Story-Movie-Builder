/**
 * Contract: Expanded project context is first-class + safely persisted
 *
 * Verifies the app and Gemini service include audio intent, content constraints,
 * and reference images across types, initialization/persistence, planning/suggestion,
 * generation, and review paths.
 */

const PROJECT_FIELDS = ["audioIntent", "contentConstraints", "referenceImages"];

export default async function run(ctx) {
  const appPath = ctx.pathJoin(ctx.appDir, ctx.appFile);
  const typesPath = ctx.pathJoin(ctx.appDir, ctx.typesFile);
  const geminiPath = ctx.pathJoin(ctx.appDir, "services", "gemini.ts");

  const appText = ctx.readText(appPath);
  const typesText = ctx.readText(typesPath);
  const geminiText = ctx.readText(geminiPath);

  // 1) Project schema includes new first-class fields.
  const projectBlock = extractInterfaceBlock(typesText, "Project");
  if (!projectBlock) {
    throw new Error(`Could not find \"export interface Project { ... }\" in ${ctx.typesFile}`);
  }
  for (const field of PROJECT_FIELDS) {
    if (!new RegExp(`\\b${field}\\??\\s*:`).test(projectBlock)) {
      throw new Error(`Project must include field: ${field}`);
    }
  }

  // 2) App default project initializes these fields.
  for (const field of PROJECT_FIELDS) {
    if (!new RegExp(`\\b${field}\\s*:`).test(appText)) {
      throw new Error(`App default project initialization must include: ${field}`);
    }
  }

  // 3) LocalStorage hydration merges parsed data with defaults (backward compatibility).
  const hasMergeHydration =
    /\{\s*\.\.\.defaultProject\s*,\s*\.\.\.(parsed|saved|loaded)Project\s*\}/m.test(appText) ||
    /\{\s*\.\.\.DEFAULT_PROJECT\s*,\s*\.\.\.(parsed|saved|loaded)Project\s*\}/m.test(appText) ||
    /\{\s*\.\.\.(defaultProject|DEFAULT_PROJECT)\s*,\s*\.\.\.[^}]+\}/m.test(appText);

  if (!hasMergeHydration) {
    throw new Error(
      "App.tsx must merge localStorage project with defaults (e.g. {...defaultProject, ...parsedProject}) so older saves receive newly required fields."
    );
  }

  // 4) Planning/suggestion calls in App pass expanded context.
  const appPlanningContextSignals = [
    "generateProjectPlan",
    "suggestNextShotPlan",
    "audioIntent",
    "contentConstraints",
    "referenceImages",
  ];
  for (const signal of appPlanningContextSignals) {
    if (!appText.includes(signal)) {
      throw new Error(`App planning/suggestion flow missing context signal: ${signal}`);
    }
  }

  // 5) Generation + review paths include reference images in app-level calls.
  const appGenReviewSignals = ["runAISelfReview", "generateVideoAttempt", "referenceImages"];
  for (const signal of appGenReviewSignals) {
    if (!appText.includes(signal)) {
      throw new Error(`App generation/review flow missing signal: ${signal}`);
    }
  }

  // 6) Gemini service consumes multimodal context end-to-end.
  const geminiSignals = [
    "generateProjectPlan",
    "suggestNextShotPlan",
    "runAISelfReview",
    "generateVideoAttempt",
    "audioIntent",
    "contentConstraints",
    "referenceImages",
  ];
  for (const signal of geminiSignals) {
    if (!geminiText.includes(signal)) {
      throw new Error(`services/gemini.ts missing expanded context signal: ${signal}`);
    }
  }

  const hasInlineImageParts =
    geminiText.includes("inlineData") ||
    geminiText.includes("parts.push") ||
    geminiText.includes("contents.parts") ||
    geminiText.includes("useRefImage");

  if (!hasInlineImageParts) {
    throw new Error(
      "Gemini multimodal flows must append reference images to prompt/config context (e.g. inlineData parts or useRefImage)."
    );
  }
}

function extractInterfaceBlock(fileText, interfaceName) {
  const re = new RegExp(`export\\s+interface\\s+${interfaceName}\\s*\\{([\\s\\S]*?)\\n\\}`, "m");
  const m = fileText.match(re);
  return m ? m[1] : null;
}
