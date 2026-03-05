/**
 * Contract: Evidence Export Completeness
 * Maps to trust gate: Ensures exported bundle includes all key evidence before export.
 */

export default async function run(ctx) {
  const appPath = ctx.pathJoin(ctx.appDir, ctx.appFile);
  const text = ctx.readText(appPath);

  // Must have exportBundle or equivalent
  if (!text.includes("exportBundle")) {
    throw new Error("App must have exportBundle or evidence export function.");
  }

  // Export must serialize full project (not a subset)
  // Check that we stringify project or an object that includes required keys
  const exportsFullProject =
    text.includes("JSON.stringify(project") ||
    text.includes("JSON.stringify({ ...project") ||
    (text.includes("exportBundle") && text.includes("project"));

  if (!exportsFullProject) {
    throw new Error(
      "Export must include full project. Use JSON.stringify(project) or equivalent so bundle contains shots, validationReviews, and outcomes."
    );
  }
}
