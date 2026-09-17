import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const algorithmHash = createHash("sha256");
for (const path of [
  "src/core/engine.ts",
  "src/core/geo.ts",
  "src/core/raster.ts",
  "src/core/solar.ts",
  "src/core/types.ts",
  "src/data/provider.ts",
  "src/data/batched-provider.ts",
  "src/data/cache.ts",
  "src/data/native-block.ts",
  "src/data/lzw.ts",
  "src/data/decoder-pool.ts",
  "src/data/decode.worker.ts",
  "package-lock.json",
]) {
  algorithmHash.update(path);
  algorithmHash.update(readFileSync(path));
}
let commit = "development";
try {
  commit = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
  /* first build */
}
export default defineConfig({
  base: "./",
  plugins: [react()],
  define: {
    __COMMIT__: JSON.stringify(commit),
    __ALGORITHM__: JSON.stringify(algorithmHash.digest("hex")),
  },
  worker: { format: "es" },
  test: { include: ["tests/**/*.test.{ts,tsx}"], environment: "node" },
});
