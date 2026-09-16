import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
let commit = "development";
try {
  commit = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
  /* first build */
}
export default defineConfig({
  base: "./",
  plugins: [react()],
  define: { __COMMIT__: JSON.stringify(commit) },
  worker: { format: "es" },
  test: { include: ["tests/**/*.test.{ts,tsx}"], environment: "node" },
});
