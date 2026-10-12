/** Opt-in network experiment at public landmarks, never personal observer sites. */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { BatchedProvider } from "../src/data/batched-provider";
import { officialZip } from "../src/data/provider";
import type { CacheEntry, TileCache } from "../src/data/cache";
import { analyzeHorizon } from "../src/features/horizon360/engine";
import { horizonDefaults } from "../src/features/horizon360/types";
const output = resolve(
  process.env.ASTRO_AUDIT_EVIDENCE ?? "../astro-audit-evidence",
);
mkdirSync(output, { recursive: true });
const sites = [
  {
    name: "Munich Olympiapark public reference",
    observer: { lat: 48.1731, lon: 11.5467 },
  },
  {
    name: "Bamberg public reference",
    observer: { lat: 49.8917, lon: 10.8918 },
  },
];
const report: unknown[] = [];
for (const site of sites) {
  const entries = new Map<string, CacheEntry>();
  const cache: TileCache = {
    get: async (key) => entries.get(key),
    put: async (key, e) => {
      entries.set(key, e);
    },
    clear: async () => entries.clear(),
  };
  const p = new BatchedProvider(
    cache,
    () => {},
    officialZip,
    1,
    64 * 1024 * 1024,
  );
  const start = performance.now();
  try {
    const r = await analyzeHorizon(
      p,
      {
        ...horizonDefaults,
        observer: site.observer,
        terrainDistance: 100,
        surfaceDistance: 10,
        maxRays: 12,
        initialAzimuthStep: 30,
        radialStep: 10,
      },
      () => {},
      "real-public-reference",
    );
    report.push({
      site,
      classification: "PARTIAL",
      wallMs: performance.now() - start,
      ground: r.ground,
      eye: r.eye,
      directions: r.directions,
      tiles: r.tiles,
      performance: r.performance,
      warnings: r.warnings,
      browserCORS: "NOT_EXECUTED",
      onSite: "NOT_EXECUTED",
    });
  } catch (e) {
    report.push({
      site,
      classification: "FAIL",
      wallMs: performance.now() - start,
      error: e instanceof Error ? e.message : String(e),
      performance: p.stats,
      browserCORS: "NOT_EXECUTED",
      onSite: "NOT_EXECUTED",
    });
  } finally {
    p.dispose();
    entries.clear();
  }
  writeFileSync(
    resolve(output, "real-data.json"),
    JSON.stringify(
      {
        node: process.version,
        startedAt: new Date().toISOString(),
        sites: report,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      site: site.name,
      elapsedMs: performance.now() - start,
      classification: (report.at(-1) as { classification: string })
        .classification,
    }),
  );
}
