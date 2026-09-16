import type {
  Model,
  ProgressFn,
  TileRecord,
  PerformanceStats,
} from "../core/types";
import type { TileCache } from "./cache";
import {
  openTile,
  officialZip,
  directURL,
  type ElevationProvider,
} from "./provider";
import { tileId, tileOrigin } from "../core/geo";
import { gridCoordinates, bilinear } from "../core/raster";

type OpenTile = Awaited<ReturnType<typeof openTile>>;
type Request = {
  points: readonly [number, number][];
  model: Model;
  resolve: (v: number[]) => void;
  reject: (e: unknown) => void;
};
export function newPerformanceStats(): PerformanceStats {
  return {
    samplePoints: 0,
    tileRequests: 0,
    uniqueTiles: 0,
    fileOpens: 0,
    fileCacheHits: 0,
    persistentHits: 0,
    downloads: 0,
    archiveBytes: 0,
    extractedBytes: 0,
    cacheReadBytes: 0,
    blocksDecoded: 0,
    blockHits: 0,
    blockEvictions: 0,
    fileEvictions: 0,
    fullRasterDecodes: 0,
    cacheReadMs: 0,
    cacheWriteMs: 0,
    downloadServiceMs: 0,
    decodeMs: 0,
    planningMs: 0,
    interpolationMs: 0,
    geometryMs: 0,
    profileMathMs: 0,
    solarMs: 0,
    peakFileBytes: 0,
    peakBlockBytes: 0,
    cacheWriteFailures: 0,
  };
}
/** Exact native-pixel queries, grouped by file and TIFF block. No resampling. */
export class BatchedProvider implements ElevationProvider {
  records = new Map<string, TileRecord>();
  stats = newPerformanceStats();
  private files = new Map<string, { tile: OpenTile; bytes: number }>();
  private opening = new Map<string, Promise<OpenTile>>();
  private blocks = new Map<string, Float32Array>();
  private fileBytes = 0;
  private blockBytes = 0;
  private queue: Request[] = [];
  private running = false;
  private lastProgress = 0;
  constructor(
    private cache: TileCache,
    private progress: ProgressFn = () => {},
    private load = officialZip,
    private concurrency = 2,
  ) {
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 2)
      throw new Error("Parallelität muss 1 oder 2 sein");
  }
  async batch<T>(work: () => Promise<T>) {
    return work();
  }
  sampleMany(
    points: readonly [number, number][],
    model: Model,
  ): Promise<number[]> {
    if (!points.length) return Promise.resolve([]);
    return new Promise((resolve, reject) => {
      this.queue.push({ points, model, resolve, reject });
      if (!this.running) {
        this.running = true;
        queueMicrotask(() => void this.drain());
      }
    });
  }
  private async drain() {
    try {
      while (this.queue.length) {
        const requests = this.queue.splice(0);
        try {
          const values = await this.sampleRequests(requests);
          requests.forEach((r, j) => r.resolve(values[j]));
        } catch (e) {
          requests.forEach((r) => r.reject(e));
        }
      }
    } finally {
      this.running = false;
    }
  }
  private emit(detail: string, done: number, total: number, force = false) {
    if (force || performance.now() - this.lastProgress > 200) {
      this.lastProgress = performance.now();
      this.progress({
        stage: "Rasterblöcke auswerten",
        fraction: total ? done / total : 0,
        detail,
        performance: { ...this.stats },
      });
    }
  }
  private async open(model: Model, id: string): Promise<OpenTile> {
    const key = model + ":" + id;
    this.stats.tileRequests++;
    const hit = this.files.get(key);
    if (hit) {
      this.stats.fileCacheHits++;
      this.files.delete(key);
      this.files.set(key, hit);
      return hit.tile;
    }
    const pending = this.opening.get(key);
    if (pending) return pending;
    const promise = this.loadFile(model, id).finally(() =>
      this.opening.delete(key),
    );
    this.opening.set(key, promise);
    return promise;
  }
  private async loadFile(model: Model, id: string) {
    const key = model + ":" + id;
    let started = performance.now(),
      entry = await this.cache.get(key);
    this.stats.cacheReadMs += performance.now() - started;
    if (entry) {
      this.stats.persistentHits++;
      this.stats.cacheReadBytes += entry.data.byteLength;
      entry = {
        ...entry,
        metadata: {
          ...entry.metadata,
          state: entry.metadata.state === "Local" ? "Local" : "Cached",
        },
      };
    } else {
      // Retrying failed persistent writes would redownload the same files in
      // every wave. Fail clearly before that can become an unbounded loop.
      if (this.records.has(key))
        throw new Error(
          "Originaldatei nicht mehr im Cache. Speicherplatz freigeben oder kleinere Analyse wählen; wiederholter Download wurde verhindert.",
        );
      const loading: TileRecord = {
        id,
        model,
        source: directURL(model, id),
        state: "Loading",
        bytes: 0,
        downloadedAt: "",
      };
      this.progress({
        stage: "Amtliche Daten laden",
        fraction: 0,
        detail: `${model.toUpperCase()} ${id}`,
        tile: loading,
        performance: { ...this.stats },
      });
      started = performance.now();
      try {
        entry = await this.load(model, id, this.progress);
      } catch (e) {
        this.progress({
          stage: "Daten",
          fraction: 0,
          detail: String(e),
          tile: { ...loading, state: "Failed" },
        });
        throw new Error(`${model} ${id}: ${String(e)}`, { cause: e });
      }
      this.stats.downloadServiceMs += performance.now() - started;
      this.stats.downloads++;
      this.stats.archiveBytes += entry.metadata.archiveBytes ?? 0;
      this.stats.extractedBytes += entry.data.byteLength;
      started = performance.now();
      try {
        await this.cache.put(key, entry);
      } catch {
        this.stats.cacheWriteFailures++;
        this.progress({
          stage: "Cache",
          fraction: 0,
          detail:
            "Originaldatei konnte nicht gespeichert werden. Falls sie später erneut benötigt wird, stoppt die Analyse statt sie endlos neu zu laden.",
        });
      }
      this.stats.cacheWriteMs += performance.now() - started;
    }
    const tile = await openTile(entry);
    this.stats.fileOpens++;
    this.records.set(key, tile.record);
    this.stats.uniqueTiles = this.records.size;
    while (
      this.fileBytes + entry.data.byteLength > 192 * 1024 * 1024 &&
      this.files.size
    ) {
      const first = this.files.keys().next().value!;
      this.fileBytes -= this.files.get(first)!.bytes;
      this.files.delete(first);
      this.stats.fileEvictions++;
    }
    this.files.set(key, { tile, bytes: entry.data.byteLength });
    this.fileBytes += entry.data.byteLength;
    this.stats.peakFileBytes = Math.max(
      this.stats.peakFileBytes,
      this.fileBytes,
    );
    this.progress({
      stage: "Amtliche Daten",
      fraction: 0,
      detail: `${model.toUpperCase()} ${id}: ${tile.record.state}`,
      tile: tile.record,
      performance: { ...this.stats },
    });
    return tile;
  }
  private async block(tile: OpenTile, bx: number, by: number) {
    const key = [
      tile.model,
      tile.id,
      tile.record.sha256 ?? tile.record.downloadedAt,
      bx,
      by,
    ].join(":");
    const hit = this.blocks.get(key);
    if (hit) {
      this.stats.blockHits++;
      this.blocks.delete(key);
      this.blocks.set(key, hit);
      return hit;
    }
    const tw = tile.image.getTileWidth(),
      th = tile.image.getTileHeight();
    const start = performance.now();
    const raster = await tile.image.readRasters({
      samples: [0],
      interleave: true,
      window: [
        bx * tw,
        by * th,
        Math.min((bx + 1) * tw, tile.width),
        Math.min((by + 1) * th, tile.height),
      ],
    });
    // Match the old provider's Float32 conversion exactly, including sources
    // whose native sample representation isn't Float32.
    const values =
      raster instanceof Float32Array ? raster : Float32Array.from(raster);
    const elapsed = performance.now() - start;
    this.stats.decodeMs += elapsed;
    tile.record.decodeMs = (tile.record.decodeMs ?? 0) + elapsed;
    this.stats.blocksDecoded++;
    if (tw >= tile.width && th >= tile.height) this.stats.fullRasterDecodes++;
    while (
      this.blockBytes + values.byteLength > 96 * 1024 * 1024 &&
      this.blocks.size
    ) {
      const first = this.blocks.keys().next().value!;
      this.blockBytes -= this.blocks.get(first)!.byteLength;
      this.blocks.delete(first);
      this.stats.blockEvictions++;
    }
    if (values.byteLength <= 96 * 1024 * 1024) {
      this.blocks.set(key, values);
      this.blockBytes += values.byteLength;
      this.stats.peakBlockBytes = Math.max(
        this.stats.peakBlockBytes,
        this.blockBytes,
      );
    }
    return values;
  }
  private async sampleRequests(requests: Request[]) {
    const start = performance.now();
    const count = requests.reduce((total, r) => total + r.points.length, 0);
    this.stats.samplePoints += count;
    const values = new Float32Array(count * 4),
      nodata = new Map<string, number | null>();
    const jobs = new Map<
      string,
      { model: Model; id: string; pixels: number[] }
    >();
    let offset = 0;
    for (const request of requests) {
      const res = request.model === "dgm1" ? 1 : 0.2,
        width = 1000 / res;
      for (let j = 0; j < request.points.length; j++) {
        const [x, y] = request.points[j],
          id = tileId(x, y),
          [ox, bottom] = tileOrigin(id),
          oy = bottom + 1000;
        const g = gridCoordinates(x, y, ox, oy, res);
        for (let corner = 0; corner < 4; corner++) {
          let col = g.col + (corner % 2),
            row = g.row + Math.floor(corner / 2),
            pixelId = id;
          if (col < 0 || row < 0 || col >= width || row >= width) {
            const px = ox + (col + 0.5) * res,
              py = oy - (row + 0.5) * res;
            pixelId = tileId(px, py);
            const [nx, ny] = tileOrigin(pixelId);
            col = Math.round((px - nx) / res - 0.5);
            row = Math.round((ny + 1000 - py) / res - 0.5);
          }
          const key = request.model + ":" + pixelId;
          let job = jobs.get(key);
          if (!job) {
            job = { model: request.model, id: pixelId, pixels: [] };
            jobs.set(key, job);
          }
          job.pixels.push((offset + j) * 4 + corner, row * width + col);
        }
      }
      offset += request.points.length;
    }
    this.stats.planningMs += performance.now() - start;
    const entries = [...jobs.values()];
    let next = 0,
      done = 0;
    this.emit(
      `${entries.length} Dateien für ${count.toLocaleString("de-DE")} Höhenabfragen`,
      0,
      entries.length,
      true,
    );
    await Promise.all(
      Array.from(
        { length: Math.min(this.concurrency, entries.length) },
        async () => {
          while (next < entries.length) {
            const job = entries[next++],
              tile = await this.open(job.model, job.id);
            nodata.set(job.model + ":" + job.id, tile.nodata);
            const tw = tile.image.getTileWidth(),
              th = tile.image.getTileHeight(),
              nx = Math.ceil(tile.width / tw);
            const groups = new Map<number, number[]>();
            for (let j = 0; j < job.pixels.length; j += 2) {
              const index = job.pixels[j + 1],
                col = index % tile.width,
                row = Math.floor(index / tile.width),
                b = Math.floor(row / th) * nx + Math.floor(col / tw);
              let refs = groups.get(b);
              if (!refs) {
                refs = [];
                groups.set(b, refs);
              }
              refs.push(job.pixels[j], index);
            }
            job.pixels = [];
            for (const [b, refs] of groups) {
              const bx = b % nx,
                by = Math.floor(b / nx),
                v = await this.block(tile, bx, by),
                bw = Math.min(tw, tile.width - bx * tw);
              for (let j = 0; j < refs.length; j += 2) {
                const col = refs[j + 1] % tile.width,
                  row = Math.floor(refs[j + 1] / tile.width);
                values[refs[j]] = v[(row - by * th) * bw + col - bx * tw];
              }
              this.emit(
                `${done}/${entries.length} Dateien · ${this.stats.blocksDecoded.toLocaleString("de-DE")} Rasterblöcke`,
                done,
                entries.length,
              );
            }
            done++;
          }
        },
      ),
    );
    const interpolationStart = performance.now();
    offset = 0;
    const output = requests.map((request) => {
      const res = request.model === "dgm1" ? 1 : 0.2;
      const result = request.points.map(([x, y], j) => {
        const id = tileId(x, y),
          [ox, oy] = tileOrigin(id),
          g = gridCoordinates(x, y, ox, oy + 1000, res),
          k = (offset + j) * 4;
        return bilinear(
          [values[k], values[k + 1], values[k + 2], values[k + 3]],
          g.fx,
          g.fy,
          nodata.get(request.model + ":" + id),
        );
      });
      offset += request.points.length;
      return result;
    });
    this.stats.interpolationMs += performance.now() - interpolationStart;
    this.emit(
      `${done}/${entries.length} Dateien ausgewertet`,
      done,
      entries.length,
      true,
    );
    return output;
  }
}
