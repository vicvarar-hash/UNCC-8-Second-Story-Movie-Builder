import path from "path";
import { defineConfig } from "vitest/config";

const appDir = process.env.APP_DIR || ".";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**"],
  },
  resolve: {
    alias: {
      // Tests import from "app/..." — resolve to repo root (integrated monorepo)
      app: path.resolve(process.cwd(), appDir),
    },
  },
});
