/**
 * Contract: Mandatory Outcome Coding Before Export
 * Maps to trust gate: Requires outcome coding before export (or warns/blocks).
 */

export default async function run(ctx) {
  const appPath = ctx.pathJoin(ctx.appDir, ctx.appFile);
  const text = ctx.readText(appPath);

  // Must gate or warn before export when outcomes are uncoded
  const hasOutcomeGate =
    text.includes("outcome") && text.includes("export") && (
      text.includes("!shot.outcome") ||
      text.includes("!s.outcome") ||
      text.includes("outcome?.") ||
      text.includes("outcomes coded") ||
      text.includes("outcome coding") ||
      text.includes("confirm") ||
      text.includes("warn") ||
      text.includes("disabled")
    );

  // Or: export button checks for uncoded outcomes before proceeding
  const hasExportCheck =
    text.includes("exportBundle") &&
    (text.includes("outcome") || text.includes("shots.some") || text.includes("every"));

  if (!hasOutcomeGate && !hasExportCheck) {
    throw new Error(
      "App must require or warn about outcome coding before export. " +
        "Gate export when shots lack outcome, or show confirmation/warning for uncoded outcomes."
    );
  }
}
