/**
 * Contract: Plan Structure Validation
 * Maps to trust gate: Before creating shots, validate parsed plan has required fields.
 * Reject with structured error. Detects schema drift (H-S2).
 */

const REQUIRED_PLAN_FIELDS = [
  "narrativeIntent",
  "videoPrompt",
  "action",
];

export default async function run(ctx) {
  const appPath = ctx.pathJoin(ctx.appDir, ctx.appFile);
  const text = ctx.readText(appPath);

  // Must have validation before creating shots from plans
  // Option A: validatePlan, validateShotPlan, or validatePlanStructure function
  // Option B: explicit check for required fields before setProject/shots
  const hasValidationFn =
    text.includes("validatePlan") ||
    text.includes("validateShotPlan") ||
    text.includes("validatePlanStructure") ||
    text.includes("validateShotPlanStructure");

  // Explicit validation: check for absence (!) of required fields before creating shots
  const hasFieldChecks = REQUIRED_PLAN_FIELDS.some(
    (field) =>
      text.includes(`!p.${field}`) ||
      text.includes(`!plan.${field}`) ||
      text.includes(`!plan?.${field}`) ||
      text.includes(`missing ${field}`) ||
      text.includes(`required: ${field}`)
  );

  if (!hasValidationFn && !hasFieldChecks) {
    throw new Error(
      "App must validate plan structure before creating shots. " +
      `Check required fields (${REQUIRED_PLAN_FIELDS.join(", ")}) and reject with structured error. ` +
      "Add validatePlan/validateShotPlan or explicit field checks."
    );
  }

  // Must throw/reject on validation failure (not silently proceed)
  const hasRejectOnInvalid =
    text.includes("throw") ||
    text.includes("throw new Error") ||
    text.includes("reject") ||
    text.includes("alert(");

  if (!hasRejectOnInvalid) {
    throw new Error(
      "Plan validation must throw or surface error when required fields are missing. " +
      "Never silently proceed with invalid plan."
    );
  }
}
