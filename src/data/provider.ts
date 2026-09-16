import { fromArrayBuffer } from "geotiff";
import { unzipSync } from "fflate";
import type { Model, ProgressFn, TileRecord } from "../core/types";
import { tileId, tileOrigin } from "../core/geo";
import { bilinear, gridCoordinates } from "../core/raster";
import type { CacheEntry, TileCache } from "./cache";

export const CATALOG = "https://geoservices.bayern.de/services/poly2metalink";
export const ATTRIBUTION =
  "Datenquelle: Bayerische Vermessungsverwaltung – www.geodaten.bayern.de (CC BY 4.0)";
export type RasterTile = {
  id: string;
  model: Model;
  ox: number;
  oy: number;
  resolution: number;
  width: number;
  height: number;
  nodata: number | null;
  values: Float32Array;
  record: TileRecord;
};
export interface ElevationProvider {
  records: Map<string, TileRecord>;
  sampleMany(
    points: readonly [number, number][],
    model: Model,
  ): Promise<number[]>;
}
export function directURL(model: Model, id: string) {
  tileOrigin(id);
  return `https://download1.bayernwolke.de/a/${model === "dgm1" ? "dgm/dgm1/" + id + ".tif" : "dom20/DOM/32" + id + "_20_DOM.tif"}`;
}
function officialURL(url: string) {
  const u = new URL(url);
  if (
    u.protocol !== "https:" ||
    !["geodaten.bayern.de", "geoservices.bayern.de"].includes(u.hostname)
  )
    throw new Error("Unerwartete URL im amtlichen Katalog");
  return u.href;
}
async function request(url: string, init: RequestInit = {}) {
  let r: Response;
  try {
    r = await fetch(url, { ...init, signal: AbortSignal.timeout(120000) });
  } catch {
    throw new Error(
      "Netzwerk/CORS: Amtliche Höhendaten nicht erreichbar. Verbindung prüfen oder GeoTIFF lokal importieren.",
    );
  }
  if (!r.ok)
    throw new Error(
      `Amtlicher Datendienst: HTTP ${r.status}. Kachel fehlt oder Dienst nicht verfügbar.`,
    );
  return r;
}
export async function officialZip(
  model: Model,
  id: string,
  onProgress: ProgressFn = () => {},
): Promise<CacheEntry> {
  const [x, y] = tileOrigin(id),
    dataset = model === "dgm1" ? "dgm1" : "dom20dom";
  const body = `SRID=25832;POLYGON((${x + 499} ${y + 499},${x + 501} ${y + 499},${x + 501} ${y + 501},${x + 499} ${y + 501},${x + 499} ${y + 499}))`;
  const r = await request(
    `${CATALOG}/zip/start/${dataset}/${crypto.randomUUID()}`,
    { method: "POST", body },
  );
  let job = (await r.json()) as {
    status: string;
    url: string;
    message?: string;
  };
  const pollUrl = job.status === "RUNNING" ? officialURL(job.url) : undefined;
  for (let attempt = 0; job.status === "RUNNING" && attempt < 90; attempt++) {
    onProgress({
      stage: "Daten",
      fraction: 0,
      detail: `${model.toUpperCase()} ${id}: amtliches ZIP wird vorbereitet`,
    });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    // The service may publish status.json while rewriting it. Retry a partial JSON
    // response on the next poll, retaining the original status URL.
    try {
      job = await (await request(pollUrl!, { cache: "no-store" })).json();
    } catch (error) {
      if (!(error instanceof SyntaxError) || attempt === 89) throw error;
    }
  }
  if (job.status !== "FINISHED_OK")
    throw new Error(
      `ZIP-Dienst: ${job.status}. ${job.message ?? "Bitte später erneut versuchen."}`,
    );
  const zipped = await request(officialURL(job.url));
  const packed = new Uint8Array(await zipped.arrayBuffer());
  if (packed.byteLength > 150 * 1024 * 1024)
    throw new Error("ZIP überschreitet das Größenlimit von 150 MB");
  const expected = model === "dgm1" ? `${id}.tif` : `32${id}_20_DOM.tif`;
  const files = unzipSync(packed, {
    filter: (f) =>
      f.name.split("/").at(-1) === expected &&
      f.originalSize <= 150 * 1024 * 1024,
  });
  const file = Object.entries(files).find(
    ([name]) => name.split("/").at(-1) === expected,
  )?.[1];
  if (!file)
    throw new Error(`Amtliche Kachel ${expected} im ZIP nicht verfügbar`);
  const data = file.slice().buffer as ArrayBuffer;
  const sha256 = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", data)),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  return {
    data,
    metadata: {
      id,
      model,
      source: directURL(model, id),
      state: "Downloaded",
      bytes: data.byteLength,
      downloadedAt: new Date().toISOString(),
      modified: zipped.headers.get("last-modified") ?? undefined,
      sha256,
    },
  };
}
export async function decodeTile(entry: CacheEntry): Promise<RasterTile> {
  const start = performance.now();
  let image;
  try {
    image = await (await fromArrayBuffer(entry.data)).getImage();
  } catch {
    throw new Error("Ungültige GeoTIFF-Datei");
  }
  const keys = image.getGeoKeys(),
    origin = image.getOrigin(),
    res = image.getResolution();
  if (
    keys?.ProjectedCSTypeGeoKey !== 25832 ||
    keys?.ProjLinearUnitsGeoKey !== 9001
  )
    throw new Error("CRS unbekannt: erwartet EPSG:25832 in Metern");
  if (keys.GTRasterTypeGeoKey !== 1)
    throw new Error("Nur GeoTIFF PixelIsArea wird unterstützt");
  const expected = entry.metadata.model === "dgm1" ? 1 : 0.2;
  if (
    Math.abs(res[0] - expected) > 1e-7 ||
    Math.abs(res[1] + expected) > 1e-7 ||
    image.getWidth() !== 1000 / expected ||
    image.getHeight() !== 1000 / expected
  )
    throw new Error(
      `Rastergeometrie passt nicht zu ${entry.metadata.model.toUpperCase()}`,
    );
  const id = tileId(origin[0] + 1, origin[1] - 1);
  const [expectedX, expectedY] = tileOrigin(id);
  if (
    Math.abs(origin[0] - expectedX) > 1e-7 ||
    Math.abs(origin[1] - (expectedY + 1000)) > 1e-7 ||
    image.getFileDirectory().hasTag("ModelTransformation")
  )
    throw new Error(
      "GeoTIFF-Raster ist verschoben oder gedreht; benötigt wird das amtliche Nordraster",
    );
  if (id !== entry.metadata.id)
    throw new Error("GeoTIFF-Lage passt nicht zur Kachel-ID");
  const raster = await image.readRasters({ samples: [0], interleave: true });
  const values = Float32Array.from(raster);
  const record = {
    ...entry.metadata,
    crs: 25832,
    resolution: expected,
    decodeMs: performance.now() - start,
  };
  return {
    id,
    model: entry.metadata.model,
    ox: origin[0],
    oy: origin[1],
    resolution: expected,
    width: image.getWidth(),
    height: image.getHeight(),
    nodata: image.getGDALNoData(),
    values,
    record,
  };
}
export class BavarianProvider implements ElevationProvider {
  records = new Map<string, TileRecord>();
  private tiles = new Map<string, RasterTile>();
  private pending = new Map<string, Promise<RasterTile>>();
  private memoryBytes = 0;
  constructor(
    private cache: TileCache,
    private progress: ProgressFn = () => {},
    private load = officialZip,
  ) {}
  async tile(model: Model, id: string): Promise<RasterTile> {
    const key = `${model}:${id}`,
      existing = this.tiles.get(key);
    if (existing) {
      this.tiles.delete(key);
      this.tiles.set(key, existing);
      return existing;
    }
    if (this.pending.has(key)) return this.pending.get(key)!;
    const promise = this.loadTile(model, id).finally(() =>
      this.pending.delete(key),
    );
    this.pending.set(key, promise);
    return promise;
  }
  private async loadTile(model: Model, id: string) {
    const key = `${model}:${id}`;
    let entry = await this.cache.get(key);
    if (entry)
      entry = {
        ...entry,
        metadata: {
          ...entry.metadata,
          state: entry.metadata.state === "Local" ? "Local" : "Cached",
        },
      };
    else {
      const loading: TileRecord = {
        id,
        model,
        state: "Loading",
        source: directURL(model, id),
        bytes: 0,
        downloadedAt: "",
      };
      this.progress({
        stage: "Daten",
        fraction: 0,
        detail: `${model.toUpperCase()} ${id} laden`,
        tile: loading,
      });
      try {
        entry = await this.load(model, id, this.progress);
      } catch (e) {
        this.progress({
          stage: "Daten",
          fraction: 0,
          detail: String(e),
          tile: { ...loading, state: "Failed" },
        });
        throw e;
      }
      try {
        await this.cache.put(key, entry);
      } catch {
        this.progress({
          stage: "Cache",
          fraction: 0,
          detail:
            "Cache voll/nicht verfügbar. Analyse läuft ohne dauerhaftes Speichern weiter.",
        });
      }
    }
    const tile = await decodeTile(entry);
    this.records.set(key, tile.record);
    this.progress({
      stage: "Daten",
      fraction: 1,
      detail: `${model.toUpperCase()} ${id}: ${tile.record.state}`,
      tile: tile.record,
    });
    while (
      this.memoryBytes + tile.values.byteLength > 256 * 1024 * 1024 &&
      this.tiles.size
    ) {
      const oldest = this.tiles.keys().next().value!;
      this.memoryBytes -= this.tiles.get(oldest)!.values.byteLength;
      this.tiles.delete(oldest);
    }
    this.tiles.set(key, tile);
    this.memoryBytes += tile.values.byteLength;
    return tile;
  }
  private async pixel(
    tile: RasterTile,
    col: number,
    row: number,
  ): Promise<number> {
    if (col >= 0 && row >= 0 && col < tile.width && row < tile.height)
      return tile.values[row * tile.width + col];
    const x = tile.ox + (col + 0.5) * tile.resolution,
      y = tile.oy - (row + 0.5) * tile.resolution;
    const neighbor = await this.tile(tile.model, tileId(x, y));
    const c = Math.round((x - neighbor.ox) / neighbor.resolution - 0.5),
      r = Math.round((neighbor.oy - y) / neighbor.resolution - 0.5);
    return neighbor.values[r * neighbor.width + c];
  }
  async sampleMany(points: readonly [number, number][], model: Model) {
    const result: number[] = [];
    let current: RasterTile | undefined;
    for (const [x, y] of points) {
      const id = tileId(x, y);
      if (current?.id !== id) current = await this.tile(model, id);
      const g = gridCoordinates(
        x,
        y,
        current.ox,
        current.oy,
        current.resolution,
      );
      let values: number[];
      if (
        g.col >= 0 &&
        g.row >= 0 &&
        g.col + 1 < current.width &&
        g.row + 1 < current.height
      ) {
        const i = g.row * current.width + g.col;
        values = [
          current.values[i],
          current.values[i + 1],
          current.values[i + current.width],
          current.values[i + current.width + 1],
        ];
      } else
        values = await Promise.all([
          this.pixel(current, g.col, g.row),
          this.pixel(current, g.col + 1, g.row),
          this.pixel(current, g.col, g.row + 1),
          this.pixel(current, g.col + 1, g.row + 1),
        ]);
      result.push(bilinear(values, g.fx, g.fy, current.nodata));
    }
    return result;
  }
}
export async function importGeoTIFF(
  file: File,
  model: Model,
  cache: TileCache,
) {
  const data = await file.arrayBuffer();
  if (data.byteLength > 150 * 1024 * 1024)
    throw new Error("Datei überschreitet 150 MB");
  const image = await (await fromArrayBuffer(data)).getImage(),
    origin = image.getOrigin();
  const id = tileId(origin[0] + 1, origin[1] - 1);
  const sha256 = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", data)),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  const metadata: TileRecord = {
    id,
    model,
    source: `local:${file.name}`,
    state: "Local",
    bytes: data.byteLength,
    downloadedAt: new Date().toISOString(),
    sha256,
  };
  await decodeTile({ data, metadata });
  await cache.put(`${model}:${id}`, { data, metadata });
  return metadata;
}
