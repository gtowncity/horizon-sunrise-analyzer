import { expect, test } from "vitest";
import {
  auditCellSource,
  cellAngleUpper,
  touchedSectors,
  type RasterCell,
  type CellStream,
  type IntervalConditions,
  type CellSource,
} from "../src/features/horizon360/raster-sectors";
import { propagateAndAudit } from "../src/features/horizon360/uncertainty";
import { horizonDefaults } from "../src/features/horizon360/types";
const conditions: IntervalConditions = {
  observerX: 0,
  observerY: 0,
  observerRadius: 0,
  eyeMin: 101.6,
  eyeMax: 101.6,
  heightError: 0,
  k: 0.13,
};
function stream(cells: RasterCell[]): CellStream {
  let complete = false;
  return {
    errors: [],
    complete: () => complete,
    cells: (async function* () {
      yield* cells;
      complete = true;
    })(),
  };
}
const cell = (
  x: number,
  y: number,
  height: number | null = 100,
  size = 1,
): RasterCell => ({ x, y, height, size, tile: "SYNTHETIC" });
test("a narrow chimney between sampled rays raises the conservative cell-sector upper", async () => {
  const a = (4.05 * Math.PI) / 180,
    c = cell(100 * Math.sin(a), 100 * Math.cos(a), 125, 0.2);
  const result = await auditCellSource(stream([c]), 101, conditions, 12, 1000);
  const independentFlatPoint = (Math.atan2(125 - 101.6, 100) * 180) / Math.PI;
  expect(result.sectors[0].modelUpper).toBeGreaterThanOrEqual(
    independentFlatPoint,
  );
  expect(result.sectors[0].status).toBe("CONDITIONAL_MODEL_BOUND");
  expect(result.geodesicCertification).toBe("NOT_CERTIFIED");
});
test("north seam footprint affects both sectors", () =>
  expect(
    touchedSectors(cell(0, 10), conditions, 12).sort((a, b) => a - b),
  ).toEqual([0, 11]));
test("observer inside uncertain cell footprint affects every direction", () =>
  expect(touchedSectors(cell(0.1, 0.1), conditions, 12)).toHaveLength(12));
test("NoData makes touched sectors UNKNOWN, never a numeric model bound", async () => {
  const r = await auditCellSource(
    stream([cell(0, 10, 110), cell(0, 11, null)]),
    12,
    conditions,
    12,
    1000,
  );
  for (const n of [0, 11]) {
    expect(r.sectors[n].knownCellUpper).not.toBeNull();
    expect(r.sectors[n].modelUpper).toBeNull();
    expect(r.sectors[n].status).toBe("UNKNOWN");
  }
});
test("cell budget invalidates all unproven sectors even with valid observed cells", async () => {
  const r = await auditCellSource(
    stream([cell(0, 10), cell(1, 10)]),
    12,
    conditions,
    12,
    1,
  );
  expect(r.completeTraversal).toBe(false);
  expect(r.sectors.every((s) => s.modelUpper === null)).toBe(true);
  expect(r.errors).toContain("CELL_BUDGET_EXHAUSTED");
});
test("source error invalidates traversed coverage", async () => {
  const s = stream([cell(0, 10)]);
  s.complete = () => false;
  s.errors.push("source quota failure");
  const r = await auditCellSource(s, 12, conditions, 12, 1000);
  expect(r.sectors.every((x) => x.modelUpper === null)).toBe(true);
});
test("unknown or physically unsupported cell height has no bound", () => {
  for (const h of [null, NaN, 5000])
    expect(cellAngleUpper(cell(0, 10, h), conditions)).toBeNull();
});
test("negative bounds stay negative; upward source error changes the bound", () => {
  expect(cellAngleUpper(cell(0, 100), conditions)).toBeLessThan(0);
  expect(
    cellAngleUpper(cell(0, 100), { ...conditions, heightError: 3 }),
  ).toBeGreaterThan(0);
});
test("conservative bound dominates independent curved geometry across cells, heights and k", () => {
  // Different Cartesian expression, radii deliberately include global min and max.
  for (const k of [0, 0.13, 0.5])
    for (const height of [90, 100, 120, 3000])
      for (const d of [2, 10, 100, 50000]) {
        const c = cell(0, d, height, 0.2),
          opts = {
            ...conditions,
            k,
            observerRadius: 0.4,
            heightError: 0.6,
            eyeMin: 100,
            eyeMax: 103,
          };
        const upper = cellAngleUpper(c, opts)!;
        for (const R0 of [6335440, 6399600])
          for (const offset of [-0.5, 0, 0.5]) {
            const dist = d + offset,
              R = R0 / (1 - k),
              actualHeight = height + 0.6;
            const oracle =
              (Math.atan2(
                (R + actualHeight) * Math.cos(dist / R) - (R + 100),
                (R + actualHeight) * Math.sin(dist / R),
              ) *
                180) /
              Math.PI;
            expect(upper + 1e-7).toBeGreaterThanOrEqual(oracle);
          }
      }
});
test("larger observer/optical disks enlarge azimuth coverage and weaken the upper", () => {
  const c = cell(10, 10, 130);
  expect(
    cellAngleUpper(c, { ...conditions, observerRadius: 3 }),
  ).toBeGreaterThan(cellAngleUpper(c, conditions)!);
  expect(
    touchedSectors(c, { ...conditions, observerRadius: 3 }, 360).length,
  ).toBeGreaterThan(touchedSectors(c, conditions, 360).length);
});
const planeSource = (gradient = false): CellSource => ({
  stream(_model, x, y, radius) {
    const cells: RasterCell[] = [];
    for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx++)
      for (let dy = -Math.ceil(radius); dy <= Math.ceil(radius); dy++)
        if (Math.hypot(dx, dy) <= radius + 0.71)
          cells.push(cell(x + dx, y + dy, 100 + (gradient ? dx : 0)));
    return stream(cells);
  },
});
test("continuous optical/vertical intervals actually alter the model horizon", async () => {
  const base = {
    ...horizonDefaults,
    terrainDistance: 10,
    surfaceDistance: 0,
    initialAzimuthStep: 30,
  };
  const a = await propagateAndAudit(planeSource(), base, 100, 10000);
  const b = await propagateAndAudit(
    planeSource(),
    {
      ...base,
      verticalUncertainty: 0.5,
      opticalHeightBelow: 1,
      opticalHeightAbove: 2,
      opticalHorizontalMotion: 1,
    },
    100,
    10000,
  );
  expect(a.eyeRange).toEqual([101.6, 101.6]);
  expect(b.eyeRange).toEqual([100.1, 104.1]);
  expect(b.observerRadius).toBe(1);
  expect(b.terrain?.sectors[0].modelUpper).toBeGreaterThan(
    a.terrain?.sectors[0].modelUpper ?? 90,
  );
});
test("relative optics include DGM variation throughout observer movement, absolute NHN does not double-add ground", async () => {
  const i = {
    ...horizonDefaults,
    terrainDistance: 10,
    surfaceDistance: 0,
    positionUncertainty: 2,
    initialAzimuthStep: 30,
  };
  const r = await propagateAndAudit(planeSource(true), i, 100, 10000);
  expect(r.eyeRange?.[0]).toBeLessThan(101.6);
  expect(r.eyeRange?.[1]).toBeGreaterThan(101.6);
  const absolute = await propagateAndAudit(
    planeSource(true),
    { ...i, absoluteEyeHeight: 150, relativeHeight: 90 },
    100,
    10000,
  );
  expect(absolute.eyeRange).toEqual([150, 150]);
});
test("unknown observer ground range prevents uncertainty bound propagation", async () => {
  const bad: CellSource = {
    stream() {
      return stream([cell(0, 0, null)]);
    },
  };
  const r = await propagateAndAudit(
    bad,
    { ...horizonDefaults, positionUncertainty: 1 },
    100,
    1000,
  );
  expect(r.eyeRange).toBeNull();
  expect(r.errors).toContain("OBSERVER_GROUND_RANGE_UNKNOWN");
  expect(r.terrain).toBeUndefined();
});
