/**
 * Contract: API Key Validation (Pre-Call Trust Gate)
 * Maps to TR6 (Failure Surfacing). services/gemini.ts must validate API key before AI calls.
 */

const AI_ENTRY_POINTS = [
  "generateProjectPlan",
  "suggestNextShotPlan",
  "runAISelfReview",
  "generateVideoAttempt",
];

export default async function run(ctx) {
  const filePath = ctx.pathJoin(ctx.appDir, "services", "gemini.ts");
  const text = ctx.readText(filePath);

  const hasValidationFn =
    text.includes("validateApiKey") || text.includes("ensureApiKey");
  if (!hasValidationFn) {
    throw new Error(
      "Missing validateApiKey or ensureApiKey. Must validate API key before AI calls and throw with clear message if missing."
    );
  }

  const hasThrow = text.includes("throw");
  const hasApiKeyMessage =
    text.includes("API key") ||
    text.includes("apiKey") ||
    text.includes("GEMINI_API_KEY");
  if (!hasThrow || !hasApiKeyMessage) {
    throw new Error(
      "Must throw an error with clear message when API key is missing."
    );
  }

  const missingEntryPoints = AI_ENTRY_POINTS.filter((fn) => !text.includes(fn));
  if (missingEntryPoints.length) {
    throw new Error(`Missing AI entry points: ${missingEntryPoints.join(", ")}`);
  }
}
