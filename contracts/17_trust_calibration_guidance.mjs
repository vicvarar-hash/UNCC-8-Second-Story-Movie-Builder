/**
 * Contract: Trust Calibration Guidance
 * Maps to trust gate: Adds examples/guidance for Over-trust / Under-trust / Calibrated.
 */

export default async function run(ctx) {
  const appPath = ctx.pathJoin(ctx.appDir, ctx.appFile);
  const text = ctx.readText(appPath);

  // Must have trust calibration in Outcome UI
  const hasTrustCalibration =
    text.includes("trustCalibration") ||
    text.includes("TrustCalibration");

  if (!hasTrustCalibration) {
    throw new Error("App must include trustCalibration in outcome coding UI.");
  }

  // Must have guidance: options or help text for calibration (Under-trust, Calibrated, Over-trust)
  const hasGuidance =
    text.includes("Under-trust") ||
    text.includes("Over-trust") ||
    text.includes("Calibrated") ||
    text.includes("tooltip") ||
    text.includes("title=") ||
    text.includes("placeholder");

  if (!hasGuidance) {
    throw new Error(
      "App must provide guidance for trust calibration (Under-trust, Calibrated, Over-trust). " +
        "Add tooltips, placeholders, or help text with examples."
    );
  }
}
