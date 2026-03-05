export default async function contract04(ctx) {
  const appPath = ctx.pathJoin(ctx.appDir, ctx.appFile);
  const text = ctx.readText(appPath);

  // Positive signal: append pattern exists
  const appendPattern = /attempts\s*:\s*\[\s*\.\.\.s\.attempts\s*,\s*newAttempt\s*\]/m;
  if (!appendPattern.test(text)) {
    throw new Error(`Could not find append-only attempts update: attempts: [...s.attempts, newAttempt]`);
  }

  // Guardrail: avoid obvious overwrite patterns (best-effort, low false positives)
  const overwritePattern = /attempts\s*:\s*\[\s*newAttempt\s*\]/m;
  if (overwritePattern.test(text)) {
    throw new Error(`Found overwrite pattern "attempts: [newAttempt]". Attempts must be append-only.`);
  }
}
