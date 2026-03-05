export default async function contract05(ctx) {
  const appPath = ctx.pathJoin(ctx.appDir, ctx.appFile);
  const text = ctx.readText(appPath);

  if (!/const\s+exportBundle\s*=\s*\(\s*\)\s*=>\s*\{/.test(text)) {
    throw new Error(`Missing exportBundle() function`);
  }

  if (!text.includes("JSON.stringify(project, null, 2)")) {
    throw new Error(`exportBundle must JSON.stringify(project, null, 2)`);
  }

  if (!text.includes("evidence_bundle_") || !text.includes("project.id")) {
    throw new Error("exportBundle must download as evidence_bundle_${project.id}.json");
  }
}
