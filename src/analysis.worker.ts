import { BrowserCache } from "./data/cache";
import { importGeoTIFF } from "./data/provider";
import { BatchedProvider, newPerformanceStats } from "./data/batched-provider";
import { analyze } from "./core/engine";
import type { Inputs } from "./core/types";
declare const __COMMIT__: string;
declare const __ALGORITHM__: string;
self.onmessage = async (
  e: MessageEvent<{ inputs: Inputs } | { file: File; model: "dgm1" | "dom20" }>,
) => {
  try {
    const cache = new BrowserCache(__ALGORITHM__);
    if ("file" in e.data) {
      const metadata = await importGeoTIFF(e.data.file, e.data.model, cache);
      self.postMessage({ type: "imported", metadata });
      return;
    }
    const progress = (p: unknown) =>
      self.postMessage({ type: "progress", progress: p });
    const started = performance.now();
    progress({
      stage: "Gespeichertes Ergebnis prüfen",
      fraction: 0,
      detail:
        "Eingaben, Softwareversion und gespeicherte Quelldaten vergleichen",
    });
    const cached = await cache.getAnalysis(e.data.inputs, __COMMIT__);
    if (cached) {
      const result = cached.analysis,
        elapsed = performance.now() - started;
      result.performance = {
        ...newPerformanceStats(),
        cacheReadBytes: cached.bytesRead,
        cacheReadMs: elapsed,
        totalMs: elapsed,
        resultCacheHit: true,
        originalElapsedMs: result.elapsedMs,
      };
      result.elapsedMs = elapsed;
      result.tiles = result.tiles.map((t) => ({
        ...t,
        state: t.state === "Local" ? "Local" : "Cached",
      }));
      self.postMessage({ type: "result", result });
      return;
    }
    const provider = new BatchedProvider(cache, progress);
    const result = await analyze(provider, e.data.inputs, progress, __COMMIT__);
    result.algorithm = __ALGORITHM__;
    if (provider.stats.cacheWriteFailures)
      result.warnings.push(
        "Einige Originaldateien konnten nicht dauerhaft gespeichert werden. Wiederverwendung ist eingeschränkt.",
      );
    try {
      await cache.putAnalysis(result);
    } catch {
      result.warnings.push(
        "Fertiges Ergebnis konnte nicht gespeichert werden. Die berechneten Werte bleiben verfügbar.",
      );
    }
    result.elapsedMs = performance.now() - started;
    if (result.performance) result.performance.totalMs = result.elapsedMs;
    self.postMessage({ type: "result", result });
  } catch (error) {
    self.postMessage({
      type: "error",
      message:
        error instanceof Error ? error.message : "Unbekannter Analysefehler",
    });
  }
};
