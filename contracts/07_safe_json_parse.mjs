/**
 * Contract: Safe JSON Parse with Error Surfacing
 * Maps to trust gate: Wrap all JSON.parse in try-catch; on failure, surface error and throw.
 * Never return empty object silently.
 */

export default async function run(ctx) {
  const filePath = ctx.pathJoin(ctx.appDir, "services", "gemini.ts");
  const text = ctx.readText(filePath);

  // Must have try/catch around JSON.parse - never silently return {} on parse failure
  if (!text.includes("try") || !text.includes("catch") || !text.includes("throw")) {
    throw new Error(
      "gemini.ts must wrap JSON.parse in try-catch and throw on parse failure. Never return empty object silently."
    );
  }

  // Must not have bare return of parsed empty object (silent failure path)
  if (text.includes("return JSON.parse(response.text || '{}')")) {
    throw new Error(
      "Must not return JSON.parse(response.text || '{}') without try-catch. Surface parse errors instead."
    );
  }

  // Must not have bare parse of shots fallback without proper error handling
  if (text.includes('JSON.parse(response.text || \'{"shots":[]}\')') && !text.includes("try")) {
    throw new Error(
      "JSON.parse for plan response must be in try-catch. Surface parse errors instead of silent failure."
    );
  }

  // Must have JSON.parse somewhere (we're validating the AI response parsing)
  if (!text.includes("JSON.parse")) {
    throw new Error("gemini.ts must parse AI responses. Add try-catch around JSON.parse.");
  }
}
