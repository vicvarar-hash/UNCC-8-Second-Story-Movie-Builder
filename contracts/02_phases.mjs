export default async function contract02(ctx) {
  const appPath = ctx.pathJoin(ctx.appDir, ctx.appFile);
  const text = ctx.readText(appPath);

  const required = ["'plan'", "'produce'", "'validate'", "'export'"];

  const unionMatch = text.match(/useState<\s*'plan'\s*\|\s*'produce'\s*\|\s*'validate'\s*\|\s*'export'\s*>\s*\(\s*'plan'\s*\)/);
  if (!unionMatch) {
    // fallback: still allow slight formatting changes but require all phases present
    for (const ph of required) {
      if (!text.includes(ph)) {
        throw new Error(`Phase union missing ${ph} in App.tsx`);
      }
    }
    throw new Error(`Could not find expected phase union useState<'plan'|'produce'|'validate'|'export'>('plan')`);
  }
}
