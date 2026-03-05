/**
 * Contract: Frame Sampling Quality Check
 * Maps to trust gate: Prevents corrupted evidence from bad frames.
 * Validate frames before passing to runAISelfReview (length, dimensions, etc).
 */

export default async function run(ctx) {
  const appPath = ctx.pathJoin(ctx.appDir, ctx.appFile);
  const geminiPath = ctx.pathJoin(ctx.appDir, "services", "gemini.ts");
  const appText = ctx.readText(appPath);
  const geminiText = ctx.readText(geminiPath);

  // App: before runAISelfReview, validate frames
  const appValidatesFrames =
    appText.includes("frames.length") ||
    appText.includes("frames.length > 0") ||
    appText.includes("frames?.length") ||
    appText.includes("validateFrames") ||
    appText.includes("frames.length === 0");

  // Gemini: sampleFrames validates before returning
  const geminiValidates =
    geminiText.includes("videoWidth") ||
    geminiText.includes("videoHeight") ||
    geminiText.includes("frames.length") ||
    geminiText.includes("reject") ||
    geminiText.includes("onerror");

  if (!appValidatesFrames && !geminiValidates) {
    throw new Error(
      "Must validate frame sampling before use. " +
        "Check frames.length > 0 before runAISelfReview, or validate in sampleFrames (video dimensions, reject on error)."
    );
  }
}
