/**
 * Contract: Video Generation Timeout
 * Maps to trust gate: Enforce max wait time on Veo polling loop. On timeout, surface TimeoutError.
 * Prevents indefinite hangs (TR7).
 */

export default async function run(ctx) {
  const filePath = ctx.pathJoin(ctx.appDir, "services", "gemini.ts");
  const text = ctx.readText(filePath);

  // Must have timeout logic in the video generation polling loop
  const hasTimeout =
    text.includes("TimeoutError") ||
    text.includes("timeout") ||
    text.includes("maxWait") ||
    text.includes("MAX_WAIT") ||
    text.includes("300000") ||
    text.includes("5 * 60 * 1000") ||
    text.includes("deadline") ||
    (text.includes("Date.now()") && text.includes("while") && text.includes("operation.done"));

  if (!hasTimeout) {
    throw new Error(
      "generateVideoAttempt must enforce a maximum wait time (e.g. 5 min) on the polling loop. " +
      "On timeout, throw TimeoutError and surface to UI. Prevents indefinite hangs (TR7)."
    );
  }

  // Must have the polling loop (we're adding timeout to it)
  if (!text.includes("while (!operation.done)")) {
    throw new Error("generateVideoAttempt must have polling loop. Add timeout to it.");
  }
}
