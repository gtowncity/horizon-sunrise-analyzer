/** Opt-in third-product control. LoD2 may share capture lineage with DOM/ALS. */
import { chromium } from "@playwright/test";
import { unzipSync } from "fflate";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { toUTM, tileId } from "../src/core/geo";
import { BatchedProvider } from "../src/data/batched-provider";
import { officialZip } from "../src/data/provider";
import type { CacheEntry, TileCache } from "../src/data/cache";
const output = resolve(
  process.env.ASTRO_AUDIT_EVIDENCE ?? "../astro-audit-evidence",
);
mkdirSync(output, { recursive: true });
const observer = { lat: 48.1731, lon: 11.5467 },
  [x, y] = toUTM(observer);
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
let browser;
let p: BatchedProvider | undefined;
const started = performance.now();
try {
  const body = `SRID=25832;POLYGON((${x - 1} ${y - 1},${x + 1} ${y - 1},${x + 1} ${y + 1},${x - 1} ${y + 1},${x - 1} ${y - 1}))`;
  const startURL =
    "https://geoservices.bayern.de/services/poly2metalink/zip/start/lod2/" +
    crypto.randomUUID();
  const res = await fetch(startURL, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error("LoD2 catalog HTTP " + res.status);
  let job = (await res.json()) as { status: string; url: string };
  const poll = job.url;
  let pollJsonRetries = 0;
  for (let n = 0; job.status === "RUNNING" && n < 90; n++) {
    await new Promise((r) => setTimeout(r, 1200));
    const response = await fetch(poll, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error("LoD2 poll HTTP " + response.status);
    try {
      job = (await response.json()) as typeof job;
    } catch (error) {
      if (!(error instanceof SyntaxError) || n === 89) throw error;
      pollJsonRetries++;
    }
  }
  if (job.status !== "FINISHED_OK")
    throw new Error("LoD2 service " + job.status);
  const url = new URL(job.url);
  if (
    url.protocol !== "https:" ||
    !["geodaten.bayern.de", "geoservices.bayern.de"].includes(url.hostname)
  )
    throw new Error("Unexpected official download host");
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error("LoD2 ZIP HTTP " + response.status);
  const reader = response.body!.getReader(),
    parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 150 * 1024 * 1024) {
      await reader.cancel();
      throw new Error("LoD2 archive exceeds bounded 150 MiB");
    }
    parts.push(value);
  }
  const zipped = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    zipped.set(part, offset);
    offset += part.length;
  }
  const archiveEntries: { name: string; bytes: number }[] = [];
  const files = unzipSync(zipped, {
    filter: (f) => {
      archiveEntries.push({ name: f.name, bytes: f.originalSize });
      return /\.(gml|xml)$/i.test(f.name) && f.originalSize <= 64 * 1024 * 1024;
    },
  });
  const entry = Object.entries(files).find(([name]) =>
    /\.(gml|xml)$/i.test(name),
  );
  if (!entry)
    throw new Error(
      "No bounded CityGML file: " + JSON.stringify(archiveEntries),
    );
  const [name, data] = entry;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const parsed = await page.evaluate(
    ({ text, x, y, id }) => {
      const xml = new DOMParser().parseFromString(text, "application/xml");
      if (xml.querySelector("parsererror"))
        throw new Error("Invalid CityGML XML");
      const roofs = Array.from(xml.getElementsByTagNameNS("*", "RoofSurface"));
      const values: number[][] = [];
      for (const roof of roofs)
        for (const list of Array.from(
          roof.getElementsByTagNameNS("*", "posList"),
        )) {
          if (
            list.getAttribute("srsDimension") &&
            list.getAttribute("srsDimension") !== "3"
          )
            continue;
          const a = list.textContent!.trim().split(/\s+/).map(Number);
          if (a.length % 3 !== 0 || !a.every(Number.isFinite)) continue;
          for (let n = 0; n < a.length; n += 3) {
            const px = a[n],
              py = a[n + 1];
            if (`${Math.floor(px / 1000)}_${Math.floor(py / 1000)}` === id)
              values.push([px, py, a[n + 2], Math.hypot(px - x, py - y)]);
          }
        }
      const seen = new Set<string>();
      const points = values
        .sort((a, b) => a[3] - b[3])
        .filter((v) => {
          const key = v.slice(0, 3).join(",");
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 24);
      const srs = Array.from(xml.querySelectorAll("[srsName]")).map((e) =>
        e.getAttribute("srsName"),
      );
      return {
        roofSurfaceCount: roofs.length,
        points,
        srsNames: [...new Set(srs)],
      };
    },
    { text: new TextDecoder().decode(data), x, y, id: tileId(x, y) },
  );
  if (
    !parsed.srsNames.some(
      (s) => s?.includes("25832") || s?.includes("ETRS89_UTM32"),
    ) ||
    parsed.points.length === 0
  )
    throw new Error(
      "No matching projected roof control points: " +
        JSON.stringify(parsed.srsNames),
    );
  const entries = new Map<string, CacheEntry>();
  const cache: TileCache = {
    get: async (k) => entries.get(k),
    put: async (k, v) => {
      entries.set(k, v);
    },
    clear: async () => entries.clear(),
  };
  p = new BatchedProvider(cache, () => {}, officialZip, 1, 64 * 1024 * 1024);
  const xy = parsed.points.map((v) => [v[0], v[1]] as [number, number]),
    dgm = await p.sampleMany(xy, "dgm1"),
    dom = await p.sampleMany(xy, "dom20");
  const controls = parsed.points.map((v, n) => ({
    x: v[0],
    y: v[1],
    lod2RoofHeight: v[2],
    distanceFromPublicReferenceM: v[3],
    dgmHeight: dgm[n],
    domHeight: dom[n],
    domMinusLod2M: dom[n] - v[2],
    lod2MinusDgmM: v[2] - dgm[n],
  }));
  if (
    !controls.every(
      (c) => Number.isFinite(c.dgmHeight) && Number.isFinite(c.domHeight),
    )
  )
    throw new Error("NoData in raster control");
  const report = {
    classification: "CONTROL_DATA_COLLECTED",
    scope:
      "LoD2 roof vertices versus independently supplied DGM/DOM product; no assertion of independent acquisition or on-site accuracy",
    observer,
    pollJsonRetries,
    archiveBytes: size,
    archiveSHA256: sha(zipped),
    file: name,
    fileSHA256: sha(data),
    fileBytes: data.length,
    srsNames: parsed.srsNames,
    roofSurfaceCount: parsed.roofSurfaceCount,
    verticalDatumVerification: parsed.srsNames.some((s) =>
      s?.includes("DHHN2016"),
    )
      ? "DECLARED_DHHN2016_IN_FILE"
      : "NOT_VERIFIED_FROM_THIS_FILE",
    controls,
    tiles: [...p.records.values()],
    wallMs: performance.now() - started,
    performance: p.stats,
    onSite: "NOT_EXECUTED",
  };
  writeFileSync(
    resolve(output, "lod2-control.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      classification: report.classification,
      points: controls.length,
      file: name,
      wallMs: report.wallMs,
    }),
  );
} catch (error) {
  writeFileSync(
    resolve(output, "lod2-control.json"),
    JSON.stringify(
      {
        classification: "FAIL",
        error: error instanceof Error ? error.message : String(error),
        wallMs: performance.now() - started,
      },
      null,
      2,
    ),
  );
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  p?.dispose();
}
