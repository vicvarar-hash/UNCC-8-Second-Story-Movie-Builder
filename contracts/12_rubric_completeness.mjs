/**
 * Contract: Rubric Completeness Check
 * Maps to trust gate: Avoid treating empty/invalid rubrics as valid evidence.
 * Before storing or displaying a rubric from runAISelfReview, validate required fields exist.
 */

const REQUIRED_RUBRIC_FIELDS = [
  "narrativeConsistency",
  "visualFidelity",
  "continuity",
  "physicsAndLogic",
  "summary",
];

export default async function run(ctx) {
  const appPath = ctx.pathJoin(ctx.appDir, ctx.appFile);
  const geminiPath = ctx.pathJoin(ctx.appDir, "services", "gemini.ts");
  const appText = ctx.readText(appPath);
  const geminiText = ctx.readText(geminiPath);

  // Must validate rubric before using it (either in App or gemini)
  const hasValidateRubric =
    appText.includes("validateRubric") ||
    appText.includes("validateSelfReviewRubric") ||
    appText.includes("validateRubricCompleteness");

  // Or explicit field checks before storing/displaying rubric
  const hasFieldChecks = REQUIRED_RUBRIC_FIELDS.some(
    (f) =>
      appText.includes(`result.${f}`) ||
      appText.includes(`rubric.${f}`) ||
      appText.includes(`!result?.${f}`) ||
      appText.includes(`missing ${f}`)
  );

  // Gemini could validate before returning
  const geminiValidates =
    geminiText.includes("validateRubric") ||
    (geminiText.includes("narrativeConsistency") && geminiText.includes("throw"));

  if (!hasValidateRubric && !hasFieldChecks && !geminiValidates) {
    throw new Error(
      "App must validate rubric completeness before storing/displaying. " +
        `Check required fields (${REQUIRED_RUBRIC_FIELDS.slice(0, 3).join(", ")}...) and reject invalid rubrics. ` +
        "Add validateRubric or explicit field checks after runAISelfReview."
    );
  }
}
