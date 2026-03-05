export default async function contract10(ctx) {
  const appPath = ctx.pathJoin(ctx.appDir, ctx.appFile);
  const text = ctx.readText(appPath);

  // 1) HARD gate in handler: must contain if (!shot.acceptedAttemptId) { ... return; }
  // We keep this as a low-fragility best-effort regex.
  const hardGate = /if\s*\(\s*!\s*shot\.acceptedAttemptId\s*\)\s*\{\s*[\s\S]{0,400}?\breturn\s*;[\s\S]{0,50}?\}/m;
  if (!hardGate.test(text)) {
    throw new Error(
      `Missing HARD acceptance gate in handleGenerateShot(): expected "if (!shot.acceptedAttemptId) { ... return; }"`
    );
  }

  // 2) UI gate: Generate button must be disabled when not accepted.
  // Your code: disabled={shot.status === 'generating' || !isAccepted}
  const uiGate = /disabled\s*=\s*\{\s*shot\.status\s*===\s*['"`]generating['"`]\s*\|\|\s*!isAccepted\s*\}/m;
  if (!uiGate.test(text)) {
    // fallback: accept other reasonable patterns, e.g. disabled={!shot.acceptedAttemptId}
    const altUiGate = /disabled\s*=\s*\{\s*!shot\.acceptedAttemptId\s*\}/m;
    if (!altUiGate.test(text)) {
      throw new Error(
        `Missing UI gating: expected Generate button disabled when not accepted (e.g., "disabled={... || !isAccepted}" or "disabled={!shot.acceptedAttemptId}")`
      );
    }
  }

  // 3) Safety check: ensure code does NOT auto-accept a new generation.
  // Your code explicitly sets acceptedAttemptId: null after generation.
  const noAutoAccept = /acceptedAttemptId\s*:\s*null/m;
  if (!noAutoAccept.test(text)) {
    throw new Error(
      `Expected regeneration to NOT auto-accept: could not find "acceptedAttemptId: null" after new attempt creation.`
    );
  }
}
