/**
 * Contract: Continuity Metadata Honesty Check
 * Maps to trust gate: Flags mismatches between metadata (useSeed, useRefImage) and what was sent to Veo.
 * Metadata recorded in GenerationAttempt should reflect what was actually passed to the API.
 */

export default async function run(ctx) {
  const geminiPath = ctx.pathJoin(ctx.appDir, "services", "gemini.ts");
  const text = ctx.readText(geminiPath);

  // generateVideoAttempt receives options: { useSeed, useRefImage }
  if (!text.includes("useSeed") || !text.includes("useRefImage")) {
    throw new Error(
      "generateVideoAttempt must receive useSeed and useRefImage in options and record them in metadata."
    );
  }

  // Must have continuity/metadata honesty: either pass options to API or document the gap
  // Check that request payload or API call uses the options
  const forwardsOptions =
    text.includes("useSeed") && (
      text.includes("requestPayload") ||
      text.includes("config") ||
      text.includes("seed") ||
      text.includes("referenceImages")
    );

  // Or: explicit comment documenting that metadata is aspirational (honesty about gap)
  const documentsGap =
    text.includes("metadata") &&
    (text.includes("aspirational") || text.includes("not yet forwarded") || text.includes("TODO"));

  if (!forwardsOptions && !documentsGap) {
    throw new Error(
      "Continuity metadata honesty: useSeed/useRefImage in metadata must match what is sent to Veo. " +
        "Either forward options to the API, or document that metadata is aspirational until implemented."
    );
  }
}
