#!/usr/bin/env node
/**
 * Fault injection script for L15 Test Gate Stress.
 * Mutates key.length < 10 → key.length > 10 in app's validateApiKeyLogic,
 * runs tests from infra, restores file. Exits 0 if fault was caught, 1 if not.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const appDir = process.env.APP_DIR || ".";
const geminiPath = path.join(repoRoot, appDir, "services", "gemini.ts");

const ORIGINAL = "key.length < 10";
const MUTANT = "key.length > 10";

function readFile() {
  return fs.readFileSync(geminiPath, "utf8");
}

function writeFile(content) {
  fs.writeFileSync(geminiPath, content, "utf8");
}

if (!fs.existsSync(geminiPath)) {
  console.error(`❌ App not found at ${geminiPath}. Set APP_DIR or ensure app repo is checked out at ./${appDir}`);
  process.exit(2);
}

const originalContent = readFile();
if (!originalContent.includes(ORIGINAL)) {
  console.error("❌ Could not find mutation target:", ORIGINAL);
  process.exit(2);
}

console.log("🔧 Injecting fault: key.length < 10 → key.length > 10");
writeFile(originalContent.replace(ORIGINAL, MUTANT));

try {
  const result = spawnSync("npm", ["run", "test"], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: true,
  });

  writeFile(originalContent);
  console.log("✅ Restored original file.");

  if (result.status !== 0) {
    console.log("\n✅ Fault was CAUGHT (tests failed as expected). Document in Artifacts repo: docs/INCIDENTS.md");
    process.exit(0);
  } else {
    console.error("\n❌ Fault SURVIVED (tests passed). False negative—add/refine tests. Document in Artifacts repo: docs/INCIDENTS.md");
    process.exit(1);
  }
} catch (err) {
  writeFile(originalContent);
  console.error("❌ Error during fault injection:", err.message);
  process.exit(2);
}
