import { unzipSync } from "fflate";
import { CATALOG, directURL } from "../../data/provider";
import { tileOrigin } from "../../core/geo";
import type { CacheEntry } from "../../data/cache";
import type { Model, ProgressFn } from "../../core/types";

export async function readBoundedArchive(
  response: Response,
  limit: number,
  onBytes: (n: number) => void = () => {},
): Promise<Uint8Array> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 150 * 1024 * 1024)
    throw new Error("Invalid archive byte budget");
  const declared = Number(response.headers.get("content-length"));
  if (declared > limit) {
    await response.body?.cancel();
    throw new Error("ARCHIVE_BUDGET: Content-Length überschreitet Restbudget");
  }
  if (!response.body) throw new Error("Leere ZIP-Antwort");
  const reader = response.body.getReader(),
    parts: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.length;
      onBytes(chunk.value.length);
      if (bytes > limit) {
        await reader.cancel();
        throw new Error("ARCHIVE_BUDGET: Stream beim Restbudget abgebrochen");
      }
      parts.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const data = new Uint8Array(bytes);
  let offset = 0;
  for (const part of parts) {
    data.set(part, offset);
    offset += part.length;
  }
  return data;
}
function official(url: string) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    !["geoservices.bayern.de", "geodaten.bayern.de"].includes(parsed.hostname)
  )
    throw new Error("Untrusted official job URL");
  return parsed.href;
}
/** Isolated new-feature loader: original sightline/solar download code untouched. */
export async function boundedOfficialZip(
  model: Model,
  id: string,
  progress: ProgressFn,
  limit: number,
  onBytes: (n: number) => void,
): Promise<CacheEntry> {
  const started = performance.now(),
    [x, y] = tileOrigin(id),
    dataset = model === "dgm1" ? "dgm1" : "dom20dom";
  const request = async (url: string, init: RequestInit = {}) => {
    const r = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(120000),
    });
    if (!r.ok) throw new Error("Amtlicher Datendienst HTTP " + r.status);
    return r;
  };
  const body = `SRID=25832;POLYGON((${x + 499} ${y + 499},${x + 501} ${y + 499},${x + 501} ${y + 501},${x + 499} ${y + 501},${x + 499} ${y + 499}))`;
  const start = () =>
    request(`${CATALOG}/zip/start/${dataset}/${crypto.randomUUID()}`, {
      method: "POST",
      body,
    });
  let response: Response;
  try {
    response = await start();
  } catch (e) {
    if (!(e instanceof Error) || !e.message.endsWith("HTTP 400")) throw e;
    progress({
      stage: "Daten",
      fraction: 0,
      detail: "Amtlicher Start HTTP 400; einmaliger neuer Versuch",
    });
    response = await start();
  }
  let job = (await response.json()) as { status: string; url: string };
  const poll = job.status === "RUNNING" ? official(job.url) : undefined;
  for (let n = 0; job.status === "RUNNING" && n < 90; n++) {
    progress({
      stage: "Daten",
      fraction: 0,
      detail: `${model.toUpperCase()} ${id}: amtliches ZIP wird vorbereitet`,
    });
    await new Promise((r) => setTimeout(r, 1200));
    try {
      job = await (await request(poll!, { cache: "no-store" })).json();
    } catch (e) {
      if (!(e instanceof SyntaxError) || n === 89) throw e;
      progress({
        stage: "Daten",
        fraction: 0,
        detail: "Status-JSON vorübergehend unvollständig; erneut prüfen",
      });
    }
  }
  if (job.status !== "FINISHED_OK")
    throw new Error("Amtlicher ZIP-Job " + job.status);
  const transferStart = performance.now(),
    archiveResponse = await request(official(job.url));
  const packed = await readBoundedArchive(archiveResponse, limit, onBytes);
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
    throw new Error(
      "Amtliche GeoTIFF-Datei im ZIP fehlt oder überschreitet Größenlimit",
    );
  const data = file.slice().buffer as ArrayBuffer;
  const sha256 = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", data)),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
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
      sha256,
      archiveBytes: packed.byteLength,
      transferMs: performance.now() - transferStart,
      serviceMs: transferStart - started,
    },
  };
}
