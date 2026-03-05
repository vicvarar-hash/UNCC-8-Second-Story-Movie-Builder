/**
 * Contract: Error Classification Gate
 * Maps to trust gate: Classifies errors for trust analysis (TR6).
 * Errors should use structured types (FailureType, etc.) rather than raw strings only.
 */

export default async function run(ctx) {
  const typesPath = ctx.pathJoin(ctx.appDir, ctx.typesFile);
  const appPath = ctx.pathJoin(ctx.appDir, ctx.appFile);
  const geminiPath = ctx.pathJoin(ctx.appDir, "services", "gemini.ts");
  const typesText = ctx.readText(typesPath);
  const appText = ctx.readText(appPath);
  const geminiText = ctx.readText(geminiPath);

  // types.ts must define error/failure taxonomy
  const hasFailureTaxonomy =
    typesText.includes("FailureType") ||
    typesText.includes("failureType") ||
    typesText.includes("FailureVisibility");

  if (!hasFailureTaxonomy) {
    throw new Error(
      "types.ts must define error/failure taxonomy (e.g. FailureType, FailureVisibility) for trust analysis."
    );
  }

  // App or gemini must use classification when storing errors
  const usesClassification =
    appText.includes("failureType") ||
    appText.includes("FailureType") ||
    (appText.includes("error") && (appText.includes("Outcome") || appText.includes("FailureType"))) ||
    geminiText.includes("VideoGenerationTimeoutError") ||
    geminiText.includes("TimeoutError");

  if (!usesClassification) {
    throw new Error(
      "When storing or surfacing errors, use structured classification (FailureType, TimeoutError, etc.) for trust analysis."
    );
  }
}
