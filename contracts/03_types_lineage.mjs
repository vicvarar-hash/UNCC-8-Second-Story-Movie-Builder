export default async function contract03(ctx) {
  const typesPath = ctx.pathJoin(ctx.appDir, ctx.typesFile);
  const text = ctx.readText(typesPath);

  // --- Shot must include attempts + acceptedAttemptId ---
  const shotBlock = extractInterfaceBlock(text, "Shot");
  if (!shotBlock) {
    throw new Error(`Could not find "export interface Shot { ... }" in ${ctx.typesFile}`);
  }

  mustContainLine(shotBlock, /attempts\s*:\s*GenerationAttempt\[\]\s*;/, 
    `Shot must include: attempts: GenerationAttempt[];`);
  mustContainLine(shotBlock, /acceptedAttemptId\s*:\s*string\s*\|\s*null\s*;/,
    `Shot must include: acceptedAttemptId: string | null;`);

  // --- GenerationAttempt must include parentAttemptId + promptSource (types can vary) ---
  const attemptBlock = extractInterfaceBlock(text, "GenerationAttempt");
  if (!attemptBlock) {
    throw new Error(`Could not find "export interface GenerationAttempt { ... }" in ${ctx.typesFile}`);
  }

  // accept any type for these fields (string, union, optional, nullable)
  mustContainLine(attemptBlock, /parentAttemptId\??\s*:/,
    `GenerationAttempt must include: parentAttemptId (optional ok).`);
  mustContainLine(attemptBlock, /promptSource\??\s*:/,
    `GenerationAttempt must include: promptSource (optional ok).`);
}

function extractInterfaceBlock(fileText, interfaceName) {
  // Best-effort extraction of: export interface X { ... }
  // Handles nested braces poorly (not expected in TS interfaces here), but fine for your schema.
  const re = new RegExp(`export\\s+interface\\s+${interfaceName}\\s*\\{([\\s\\S]*?)\\n\\}`, "m");
  const m = fileText.match(re);
  return m ? m[1] : null;
}

function mustContainLine(block, regex, errMsg) {
  if (!regex.test(block)) {
    throw new Error(errMsg);
  }
}
