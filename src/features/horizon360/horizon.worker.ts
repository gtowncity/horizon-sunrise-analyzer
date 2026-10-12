import { BrowserCache } from "../../data/cache";
import { BatchedProvider } from "../../data/batched-provider";
import { officialZip } from "../../data/provider";
import { analyzeHorizon, validateHorizonInputs } from "./engine";
import type { HorizonInputs } from "./types";
import { NativeCellSource } from "./cell-source";
import { propagateAndAudit } from "./uncertainty";
declare const __COMMIT__: string;
self.onmessage = async (e: MessageEvent<HorizonInputs>) => {
  let provider: BatchedProvider | undefined;
  try {
    const started = performance.now();
    validateHorizonInputs(e.data);
    const cache = new BrowserCache();
    const attempted = new Set<string>(),
      failed = new Set<string>();
    let bytes = 0;
    const load: typeof officialZip = async (model, id, progress) => {
      const key = model + ":" + id;
      if (failed.has(key))
        throw new Error("Kachel zuvor fehlgeschlagen; keine erneute Anfrage");
      if (!attempted.has(key) && attempted.size >= e.data.maxTiles)
        throw new Error("Kachelbudget erreicht");
      // Loader caps each archive at 150 MiB; reserve that upper bound before a transfer.
      if (bytes + 150 * 1024 * 1024 > e.data.maxArchiveBytes)
        throw new Error(
          "Archivbudget: für nächste Kachel keine 150 MiB Obergrenze verfügbar",
        );
      attempted.add(key);
      try {
        const entry = await officialZip(model, id, progress);
        bytes += entry.metadata.archiveBytes ?? 0;
        return entry;
      } catch (error) {
        failed.add(key);
        throw error;
      }
    };
    provider = new BatchedProvider(
      cache,
      (p) => self.postMessage({ type: "progress", progress: p }),
      load,
      1,
      64 * 1024 * 1024,
      { decoderWorkers: 0, blocksInFlight: 2 },
    );
    const result = await analyzeHorizon(
      provider,
      e.data,
      (p) => self.postMessage({ type: "progress", progress: p }),
      __COMMIT__,
    );
    if (e.data.mode === "DETAIL") {
      self.postMessage({
        type: "progress",
        progress: {
          stage: "Rasterzellen / Unsicherheitsintervalle",
          fraction: 0,
          detail:
            "Native Pixel-Fußabdrücke im EPSG25832-Modell prüfen; keine geodätische Zertifizierung",
        },
      });
      const cells = new NativeCellSource(cache, load);
      result.spatialAudit = await propagateAndAudit(
        cells,
        e.data,
        result.ground,
        e.data.maxCells ?? 200000,
      );
      result.cellMetrics = cells.metrics;
      const records = new Map(
        result.tiles.map((t) => [t.model + ":" + t.id, t]),
      );
      for (const [key, t] of cells.records) records.set(key, t);
      result.tiles = [...records.values()];
      result.warnings.push(
        "Zellobergrenzen gelten nur im deklarierten projizierten Modell. Geografischer Nord-/Distanzbezug, Aufnahmezustand und physische Genauigkeit nicht zertifiziert; N.I.N.A. gesperrt.",
      );
      if (result.spatialAudit.errors.length)
        result.warnings.push(...result.spatialAudit.errors);
    }
    result.elapsedMs = performance.now() - started;
    self.postMessage({ type: "result", result });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "360° Fehler",
    });
  } finally {
    provider?.dispose();
  }
};
