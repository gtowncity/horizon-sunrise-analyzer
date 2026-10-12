/** Conservative interval kernel for the explicitly declared projected-grid model.
 * Certification of EPSG25832 distances/azimuths as true geodesy is NOT inferred. */
export type RasterCell = {
  x: number;
  y: number;
  size: number;
  height: number | null;
  tile: string;
};
export type CellStream = {
  cells: AsyncIterable<RasterCell>;
  complete: () => boolean;
  errors: string[];
};
export interface CellSource {
  stream(
    model: "dgm1" | "dom20",
    x: number,
    y: number,
    radius: number,
  ): CellStream;
}
export type IntervalConditions = {
  observerX: number;
  observerY: number;
  observerRadius: number;
  eyeMin: number;
  eyeMax: number;
  heightError: number;
  k: number;
};
export type CellSector = {
  start: number;
  end: number;
  knownCellUpper: number | null;
  modelUpper: number | null;
  status: "UNKNOWN" | "CONDITIONAL_MODEL_BOUND";
  cells: number;
  missing: number;
};
export type SourceCellAudit = {
  frame: "EPSG25832_GRID_NORTH";
  reconstruction: "PIXEL_FOOTPRINT_CONSTANT";
  geodesicCertification: "NOT_CERTIFIED";
  radius: number;
  evaluatedCells: number;
  completeTraversal: boolean;
  sectors: CellSector[];
  errors: string[];
  elapsedMs: number;
  conditions: IntervalConditions;
};
const a = 6378137,
  f = 1 / 298.257222101,
  e2 = f * (2 - f);
const minimumNormalRadius = a * (1 - e2);
const degrees = 180 / Math.PI;
export function touchedSectors(
  cell: RasterCell,
  c: IntervalConditions,
  count: number,
): number[] {
  const dx = cell.x - c.observerX,
    dy = cell.y - c.observerY,
    d = Math.hypot(dx, dy);
  const radius = (Math.SQRT2 * cell.size) / 2 + c.observerRadius;
  if (d <= radius) return Array.from({ length: count }, (_, n) => n);
  const az = (Math.atan2(dx, dy) * degrees + 360) % 360;
  const half = Math.asin(Math.min(1, radius / d)) * degrees;
  const step = 360 / count,
    indices = new Set<number>();
  // Include boundary contacts in BOTH sectors (closed footprints).
  for (
    let n = Math.floor((az - half) / step) - 1;
    n <= Math.floor((az + half) / step);
    n++
  ) {
    if ((n + 1) * step >= az - half && n * step <= az + half)
      indices.add(((n % count) + count) % count);
  }
  return [...indices];
}
export function cellAngleUpper(
  cell: RasterCell,
  c: IntervalConditions,
): number | null {
  if (
    cell.height === null ||
    !Number.isFinite(cell.height) ||
    cell.height < -100 ||
    cell.height > 4000
  )
    return null;
  const h = cell.height + c.heightError,
    delta = h - c.eyeMin;
  const d = Math.hypot(cell.x - c.observerX, cell.y - c.observerY);
  const radius = (Math.SQRT2 * cell.size) / 2 + c.observerRadius;
  const lo = Math.max(0, d - radius),
    hi = d + radius;
  if (hi > 100000 || h > 5000 || c.eyeMin < -1000) return null;
  if (!lo && delta >= 0) return 90; // possible zenith interception, not a missing-data replacement
  const R = minimumNormalRadius / (1 - c.k);
  // sin(t) >= t(1-t²/6), cos(t)-1 <= 0. Valid t <=100km/R.
  const acrossMin = lo * (1 - 200 / R) * (1 - (hi / R) ** 2 / 6);
  const acrossMax = hi * (1 + Math.max(0, h) / R);
  return Math.atan2(delta, delta >= 0 ? acrossMin : acrossMax) * degrees;
}
export async function auditCellSource(
  stream: CellStream,
  radius: number,
  conditions: IntervalConditions,
  sectorCount: number,
  maxCells: number,
  signal?: AbortSignal,
): Promise<SourceCellAudit> {
  if (
    !Number.isInteger(sectorCount) ||
    sectorCount < 12 ||
    sectorCount > 720 ||
    !Number.isInteger(maxCells) ||
    maxCells < 0 ||
    !Object.values(conditions).every(Number.isFinite) ||
    conditions.eyeMin > conditions.eyeMax ||
    conditions.observerRadius < 0 ||
    conditions.heightError < 0 ||
    conditions.k < 0 ||
    conditions.k > 0.5
  )
    throw new Error("Invalid cell-bound conditions");
  const start = performance.now();
  const sectors: CellSector[] = Array.from({ length: sectorCount }, (_, n) => ({
    start: (n * 360) / sectorCount,
    end: ((n + 1) * 360) / sectorCount,
    knownCellUpper: null,
    modelUpper: null,
    status: "UNKNOWN",
    cells: 0,
    missing: 0,
  }));
  let count = 0,
    exhausted = false;
  for await (const cell of stream.cells) {
    signal?.throwIfAborted();
    if (count >= maxCells) {
      exhausted = true;
      break;
    }
    count++;
    const upper = cellAngleUpper(cell, conditions);
    for (const n of touchedSectors(cell, conditions, sectorCount)) {
      const s = sectors[n];
      s.cells++;
      if (upper === null) s.missing++;
      else
        s.knownCellUpper =
          s.knownCellUpper === null ? upper : Math.max(s.knownCellUpper, upper);
    }
  }
  const complete = !exhausted && stream.complete();
  for (const s of sectors)
    if (complete && !s.missing && s.cells > 0 && s.knownCellUpper !== null) {
      s.status = "CONDITIONAL_MODEL_BOUND";
      s.modelUpper = s.knownCellUpper;
    }
  return {
    frame: "EPSG25832_GRID_NORTH",
    reconstruction: "PIXEL_FOOTPRINT_CONSTANT",
    geodesicCertification: "NOT_CERTIFIED",
    radius,
    evaluatedCells: count,
    completeTraversal: complete,
    sectors,
    errors: [...stream.errors, ...(exhausted ? ["CELL_BUDGET_EXHAUSTED"] : [])],
    elapsedMs: performance.now() - start,
    conditions,
  };
}
