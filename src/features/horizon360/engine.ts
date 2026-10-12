import {
  apparentAngle,
  corridorTiles,
  destinationAlong,
  normalRadius,
  normalizeAzimuth,
  tileId,
  toUTM,
} from "../../core/geo";
import type { ElevationProvider } from "../../data/provider";
import type { Model, ProgressFn } from "../../core/types";
import type {
  HorizonInputs,
  HorizonResult,
  HorizonDirection,
  SourceScan,
} from "./types";

export function validateHorizonInputs(i: HorizonInputs) {
  if (!i?.observer || !["FAST", "DETAIL"].includes(i.mode))
    throw new Error("Unbekannter Horizontmodus");
  const ranges: [number, number, number, string][] = [
    [i.observer.lat, 47, 51, "Standort Breite"],
    [i.observer.lon, 8.5, 14.1, "Standort Länge"],
    [i.relativeHeight, 0.05, 100, "Optikhöhe"],
    [i.terrainDistance, 10, 80000, "Geländedistanz"],
    [i.surfaceDistance, 0, Math.min(i.terrainDistance, 2000), "DOM-Distanz"],
    [i.terrainK, 0, 0.5, "Gelände k"],
    [i.surfaceK, 0, 0.5, "Oberfläche k"],
    [i.minAltitude, -90, 90, "Mindesthöhe"],
    [i.margin, 0, 30, "Reserve"],
    [i.positionUncertainty, 0, 1000, "Positionsunsicherheit"],
    [i.verticalUncertainty, 0, 100, "Höhenbudget"],
    [i.initialAzimuthStep, 1, 30, "Azimutstart"],
    [i.minimumAzimuthStep, 0.1, i.initialAzimuthStep, "Azimutminimum"],
    [i.radialStep, 0.2, 100, "Distanzschritt"],
    [i.refinementTolerance, 0.001, 5, "Verfeinerung"],
    [i.maxRays, 12, 720, "Strahlenbudget"],
    [i.maxSamples, 1000, 2000000, "Punktbudget"],
    [i.maxTiles, 1, 100, "Kachelbudget"],
    [i.maxArchiveBytes, 1048576, 1073741824, "Archivbudget"],
  ];
  for (const [key, limit] of [
    ["opticalHorizontalMotion", 100],
    ["opticalHeightBelow", 100],
    ["opticalHeightAbove", 100],
    ["terrainHeightError", 100],
    ["surfaceHeightError", 100],
    ["maxCells", 2000000],
  ] as const) {
    if (i[key] !== undefined)
      ranges.push([i[key]!, key === "maxCells" ? 1000 : 0, limit, key]);
  }
  if (i.maxCells !== undefined && !Number.isInteger(i.maxCells))
    throw new Error("Zellbudget muss ganzzahlig sein");
  if (i.absoluteEyeHeight !== undefined)
    ranges.push([i.absoluteEyeHeight, -100, 4000, "DHHN2016 Optikhöhe"]);
  for (const [v, lo, hi, name] of ranges)
    if (!Number.isFinite(v) || v < lo || v > hi)
      throw new Error(`${name}: ${lo}..${hi}`);
  for (const k of [i.maxRays, i.maxSamples, i.maxTiles, i.maxArchiveBytes])
    if (!Number.isInteger(k)) throw new Error("Budgets müssen ganzzahlig sein");
}

export function preflight(i: HorizonInputs) {
  validateHorizonInputs(i);
  const ids = new Set([
    ...corridorTiles(i.observer, 0, 180, i.terrainDistance),
    ...corridorTiles(i.observer, 180, 360, i.terrainDistance),
  ]);
  const surface = i.surfaceDistance
    ? new Set([
        ...corridorTiles(i.observer, 0, 180, i.surfaceDistance),
        ...corridorTiles(i.observer, 180, 360, i.surfaceDistance),
      ]).size
    : 0;
  return { tileUpperBound: ids.size + surface, bytes: null };
}

/** Observed values only. No completeness claim from midpoint convergence. */
export async function analyzeHorizon(
  provider: ElevationProvider,
  i: HorizonInputs,
  progress: ProgressFn = () => {},
  commit = "development",
  signal?: AbortSignal,
): Promise<HorizonResult> {
  validateHorizonInputs(i);
  const start = performance.now(),
    plan = preflight(i);
  const ground = (await provider.sampleMany([toUTM(i.observer)], "dgm1"))[0];
  if (!Number.isFinite(ground))
    throw new Error("UNKNOWN: Beobachterboden ohne gültiges DGM1");
  const eye = i.absoluteEyeHeight ?? ground + i.relativeHeight;
  let evaluated = 1;
  const warnings = new Set<string>([
    "VORLÄUFIG: adaptive Strahlen, keine vollständige Rasterzellprüfung; schmale Hindernisse können fehlen.",
    "Stichprobenkurve verwendet die nominale Optik; Unsicherheitsintervalle stehen ausschließlich im separaten Zellbericht. Keine statistischen Konfidenzintervalle oder physische Genauigkeitsgarantie.",
    "Endliche DGM-/DOM-Domänen. DOM außerhalb der gewählten Nahdistanz ungeprüft; Quellalter und aktueller Bewuchs unbekannt.",
    "k ist ein terrestrisches Szenario; Normalhöhen im lokalen GRS80-Modell, ohne Lotabweichung/Geoidneigung.",
  ]);
  const scan = async (
    azimuth: number,
    model: Model,
    distance: number,
    step: number,
  ): Promise<SourceScan> => {
    const out: SourceScan = {
      status: "UNKNOWN",
      requestedDistance: distance,
      sampledTo: 0,
      maxRadialGap: 0,
      attempted: 0,
      valid: 0,
      blocker: null,
      errors: [],
    };
    if (!distance) return out;
    const locate = destinationAlong(i.observer, azimuth),
      radius = normalRadius(i.observer.lat, azimuth),
      k = model === "dgm1" ? i.terrainK : i.surfaceK;
    const sampled: { d: number; a: number }[] = [];
    const query = async (distances: number[]) => {
      const usable = distances.slice(0, Math.max(0, i.maxSamples - evaluated));
      if (usable.length < distances.length)
        warnings.add("Punktbudget erreicht; Sektoren unvollständig.");
      if (!usable.length) return;
      signal?.throwIfAborted();
      const positions = usable.map(locate);
      let values: number[];
      evaluated += usable.length;
      out.attempted += usable.length;
      try {
        values = await provider.sampleMany(positions.map(toUTM), model);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Datenfehler";
        out.errors.push(message);
        warnings.add(message);
        return;
      }
      for (let n = 0; n < usable.length; n++) {
        if (!Number.isFinite(values[n])) {
          out.errors.push("NoData");
          continue;
        }
        const d = usable[n],
          a = apparentAngle(d, values[n], eye, radius, k);
        sampled.push({ d, a });
        out.valid++;
        out.sampledTo = Math.max(out.sampledTo, d);
        if (!out.blocker || a > out.blocker.angle)
          out.blocker = {
            ...positions[n],
            distance: d,
            height: values[n],
            angle: a,
            model,
            tile: tileId(...toUTM(positions[n])),
          };
      }
    };
    // Streaming batches also constrain cancellation latency and geometry arrays.
    const count = Math.ceil(distance / step);
    for (let n = 1; n <= count; n += 512) {
      if (evaluated >= i.maxSamples) {
        warnings.add("Punktbudget erreicht; Sektoren unvollständig.");
        break;
      }
      const before = out.errors.length;
      await query(
        Array.from({ length: Math.min(512, count - n + 1) }, (_, j) =>
          Math.min((n + j) * step, distance),
        ),
      );
      if (out.errors.length > before) break; // do not repeatedly retry a failed service
    }
    // Around up to eight promising sampled peaks; no synthetic upper bound.
    const peaks = sampled
      .filter(
        (p, n) =>
          n > 0 &&
          n < sampled.length - 1 &&
          p.a >= sampled[n - 1].a &&
          p.a >= sampled[n + 1].a,
      )
      .sort((a, b) => b.a - a.a)
      .slice(0, 8);
    const existing = new Set(sampled.map((p) => p.d));
    const extra = new Set<number>();
    for (const p of peaks)
      for (const fraction of [-0.75, -0.5, -0.25, 0.25, 0.5, 0.75]) {
        const d = p.d + step * fraction;
        if (d > 0 && d <= distance && !existing.has(d)) extra.add(d);
      }
    if (!out.errors.length) await query([...extra].sort((a, b) => a - b));
    sampled.sort((a, b) => a.d - b.d);
    let previous = 0;
    for (const p of sampled) {
      out.maxRadialGap = Math.max(out.maxRadialGap, p.d - previous);
      previous = p.d;
    }
    out.maxRadialGap = Math.max(out.maxRadialGap, distance - previous);
    out.errors = [...new Set(out.errors)];
    out.status = out.blocker ? "INCOMPLETE" : "UNKNOWN";
    return out;
  };
  const rays = new Map<number, HorizonDirection>();
  const ray = async (az: number) => {
    signal?.throwIfAborted();
    const a = normalizeAzimuth(az);
    if (rays.has(a) || rays.size >= i.maxRays || evaluated >= i.maxSamples)
      return;
    const terrain = await scan(a, "dgm1", i.terrainDistance, i.radialStep);
    const surface = await scan(
      a,
      "dom20",
      i.surfaceDistance,
      Math.min(i.radialStep, i.mode === "DETAIL" ? 0.5 : 2),
    );
    const valid = [terrain.blocker?.angle, surface.blocker?.angle].filter(
      (v): v is number => v !== undefined,
    );
    const actual = valid.length ? Math.max(...valid) : null;
    rays.set(a, {
      azimuth: a,
      terrain,
      surface,
      actual,
      planning:
        actual === null ? null : Math.max(actual + i.margin, i.minAltitude),
      status: actual === null ? "UNKNOWN" : "INCOMPLETE",
      nextAngularGap: 0,
    });
    progress({
      stage: "360°-Horizont",
      fraction: rays.size / i.maxRays,
      detail: `${rays.size} Richtungen · ${evaluated} Rasterabfragen · VORLÄUFIG`,
      performance: provider.stats,
    });
  };
  const count = Math.ceil(360 / i.initialAzimuthStep);
  for (let n = 0; n < count; n++) await ray((360 * n) / count);
  // First midpoint pass covers all intervals. Further passes target observed edges.
  for (let depth = 0; depth < 8; depth++) {
    const sorted = [...rays.values()].sort((a, b) => a.azimuth - b.azimuth);
    const before = rays.size;
    for (let n = 0; n < sorted.length; n++) {
      const a = sorted[n],
        b = sorted[(n + 1) % sorted.length],
        end = b.azimuth + (n === sorted.length - 1 ? 360 : 0),
        gap = end - a.azimuth;
      if (gap / 2 < i.minimumAzimuthStep) continue;
      if (
        depth === 0 ||
        a.actual === null ||
        b.actual === null ||
        Math.abs(a.actual - b.actual) > i.refinementTolerance
      )
        await ray((a.azimuth + end) / 2);
    }
    if (rays.size === before) break;
  }
  if (rays.size >= i.maxRays)
    warnings.add("Strahlenbudget erreicht; keine Winkelkonvergenzgarantie.");
  const directions = [...rays.values()].sort((a, b) => a.azimuth - b.azimuth);
  directions.forEach((d, n) => {
    d.nextAngularGap =
      directions[(n + 1) % directions.length].azimuth +
      (n === directions.length - 1 ? 360 : 0) -
      d.azimuth;
  });
  progress({
    stage: "360° abgeschlossen",
    fraction: 1,
    detail: "PARTIAL: wissenschaftliche Vollständigkeit nicht nachgewiesen",
  });
  return {
    schema: "astro360-3",
    method: "adaptive-rays-v3",
    semantics: {
      actual: "NOMINAL_SAMPLED_MAXIMUM",
      planning: "NOMINAL_SAMPLED_REFERENCE_NOT_SAFE",
    },
    commit,
    timestamp: new Date().toISOString(),
    inputs: structuredClone(i),
    ground,
    eye,
    directions,
    tiles: [...provider.records.values()],
    warnings: [...warnings],
    elapsedMs: performance.now() - start,
    evaluatedSamples: evaluated,
    preflight: plan,
    performance: provider.stats ? { ...provider.stats } : undefined,
  };
}
