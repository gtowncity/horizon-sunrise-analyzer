import { describe, expect, test } from "vitest";
import {
  analyzeHorizon,
  preflight,
  validateHorizonInputs,
} from "../src/features/horizon360/engine";
import {
  horizonDefaults,
  type HorizonInputs,
  type HorizonResult,
} from "../src/features/horizon360/types";
import {
  exportHorizonCSV,
  exportHorizonJSON,
  exportNina,
  importHorizonJSON,
} from "../src/features/horizon360/export";
import { fromUTM, inverse } from "../src/core/geo";
import type { ElevationProvider } from "../src/data/provider";

const inputs: HorizonInputs = {
  ...horizonDefaults,
  terrainDistance: 100,
  surfaceDistance: 0,
  initialAzimuthStep: 30,
  minimumAzimuthStep: 1,
  maxRays: 12,
  radialStep: 10,
};
function synthetic(
  fn: (distance: number, azimuth: number, surface: boolean) => number,
): ElevationProvider {
  return {
    records: new Map(),
    async sampleMany(points, model) {
      return points.map(([x, y]) => {
        const p = inverse(inputs.observer, fromUTM(x, y));
        return p.distance < 0.001
          ? 100
          : fn(p.distance, p.azimuth, model === "dom20");
      });
    },
  };
}
/** Independent Cartesian spherical reference; GRS80 radius calculated here. */
function reference(
  d: number,
  h: number,
  eye: number,
  lat: number,
  az: number,
  k: number,
) {
  const rad = Math.PI / 180,
    a = 6378137,
    f = 1 / 298.257222101,
    e = f * (2 - f),
    q = 1 - e * Math.sin(lat * rad) ** 2;
  const m = (a * (1 - e)) / q ** 1.5,
    n = a / Math.sqrt(q),
    r =
      1 / (Math.cos(az * rad) ** 2 / m + Math.sin(az * rad) ** 2 / n) / (1 - k);
  const x = (r + h) * Math.sin(d / r),
    y = (r + h) * Math.cos(d / r) - (r + eye);
  return Math.atan2(y, x) / rad;
}
async function flat(extra: Partial<HorizonInputs> = {}) {
  return analyzeHorizon(
    synthetic(() => 100),
    { ...inputs, ...extra },
  );
}
describe("independent geometry controls", () => {
  test.each([0, 0.13, 0.5])("plane curvature k=%s", async (k) => {
    const r = await flat({ terrainK: k });
    for (const p of r.directions)
      expect(p.actual).toBeCloseTo(
        reference(100, 100, 101.6, inputs.observer.lat, p.azimuth, k),
        7,
      );
  });
  test.each([0.6, 10, 50])(
    "roof/hill at near range height=%s",
    async (height) => {
      const r = await analyzeHorizon(
        synthetic((d) => (d < 11 ? 100 + height : 100)),
        inputs,
      );
      for (const p of r.directions) {
        const expected = Math.max(
          reference(
            10,
            100 + height,
            101.6,
            inputs.observer.lat,
            p.azimuth,
            inputs.terrainK,
          ),
          reference(
            100,
            100,
            101.6,
            inputs.observer.lat,
            p.azimuth,
            inputs.terrainK,
          ),
        );
        expect(p.actual).toBeCloseTo(expected, 6);
      }
    },
  );
  test("absolute NHN eye replaces relative height", async () => {
    const a = await flat({ absoluteEyeHeight: 105, relativeHeight: 1.6 }),
      b = await flat({ absoluteEyeHeight: 105, relativeHeight: 20 });
    expect(a.eye).toBe(105);
    expect(a.directions).toEqual(b.directions);
  });
  test("optical motion changes observed angles monotonically at fixed locations", async () => {
    const low = await flat({ relativeHeight: 1 }),
      high = await flat({ relativeHeight: 3 });
    low.directions.forEach((d, n) =>
      expect(high.directions[n].actual!).toBeLessThan(d.actual!),
    );
  });
  test("DGM and DOM maxima selected independently", async () => {
    const r = await analyzeHorizon(
      synthetic((d, _a, surface) => (surface && d < 11 ? 110 : 100)),
      { ...inputs, surfaceDistance: 20 },
    );
    for (const d of r.directions) {
      expect(d.surface.blocker?.model).toBe("dom20");
      expect(d.actual).toBe(d.surface.blocker?.angle);
      expect(d.surface.sampledTo).toBe(20);
      expect(d.terrain.sampledTo).toBe(100);
    }
  });
  test("near roof 0.6 m error sensitivity is not 0.2 m pixel accuracy", () => {
    expect((Math.atan(0.6 / 10) * 180) / Math.PI).toBeCloseTo(3.43363036, 7);
  });
});
describe("coverage, refinement and resource honesty", () => {
  test("negative terrain remains negative; planning is separate", async () => {
    const r = await flat({ minAltitude: -2, margin: 0.25 });
    expect(r.directions[0].actual).toBeLessThan(0);
    expect(r.directions[0].planning).toBeCloseTo(
      r.directions[0].actual! + 0.25,
      12,
    );
    expect(r.directions.every((d) => d.status === "INCOMPLETE")).toBe(true);
  });
  test("NoData is UNKNOWN, never zero", async () => {
    const r = await analyzeHorizon(
      synthetic(() => NaN),
      inputs,
    );
    expect(
      r.directions.every(
        (d) =>
          d.actual === null && d.planning === null && d.status === "UNKNOWN",
      ),
    ).toBe(true);
  });
  test("NoData observer rejects", async () => {
    const p: ElevationProvider = {
      records: new Map(),
      sampleMany: async (ps) => ps.map(() => NaN),
    };
    await expect(analyzeHorizon(p, inputs)).rejects.toThrow("Beobachterboden");
  });
  test("remote DOM failure preserves terrain and exposes error", async () => {
    const p = synthetic(() => 100),
      fn = p.sampleMany.bind(p);
    p.sampleMany = (ps, m) =>
      m === "dom20" ? Promise.reject(new Error("CORS fixture")) : fn(ps, m);
    const r = await analyzeHorizon(p, { ...inputs, surfaceDistance: 100 });
    expect(r.directions[0].surface.status).toBe("UNKNOWN");
    expect(r.directions[0].terrain.status).toBe("INCOMPLETE");
    expect(r.warnings).toContain("CORS fixture");
    expect(() => exportNina(r, false, true)).toThrow("UNKNOWN");
  });
  test("FAST and DETAIL agree with identical effective sample inputs", async () => {
    const a = await flat(),
      b = await flat({ mode: "DETAIL" });
    expect(a.directions).toEqual(b.directions);
  });
  test("angular seam and midpoint scan include north-neighbor", async () => {
    const r = await flat({ maxRays: 48 });
    expect(r.directions[0].azimuth).toBe(0);
    expect(r.directions.at(-1)?.azimuth).toBe(345);
    expect(r.directions.at(-1)?.nextAngularGap).toBe(15);
    expect(r.directions.reduce((s, d) => s + d.nextAngularGap, 0)).toBe(360);
  });
  test("unseen narrow chimney never permits completeness", async () => {
    const r = await analyzeHorizon(
      synthetic((_d, a) => (a > 4 && a < 4.1 ? 500 : 100)),
      { ...inputs, maxRays: 48 },
    );
    expect(r.directions.every((d) => d.status === "INCOMPLETE")).toBe(true);
    expect(r.warnings.some((w) => w.includes("schmale"))).toBe(true);
  });
  test("adaptive angular edge adds supporting rays", async () => {
    const r = await analyzeHorizon(
      synthetic((_d, a) => (a > 40 && a < 120 ? 150 : 100)),
      { ...inputs, maxRays: 100 },
    );
    expect(r.directions.length).toBeGreaterThan(24);
    expect(r.directions.some((d) => d.azimuth > 40 && d.azimuth < 45)).toBe(
      true,
    );
  });
  test("radial peak refinement finds finer peak without deleting coarse maxima", async () => {
    const r = await analyzeHorizon(
      synthetic((d) =>
        Math.abs(d - 50) < 0.1 ? 110 : Math.abs(d - 52.5) < 0.1 ? 120 : 100,
      ),
      inputs,
    );
    expect(r.directions[0].terrain.blocker?.distance).toBe(52.5);
    expect(r.directions[0].terrain.valid).toBeGreaterThan(10);
  });
  test("sample budget respected and domain tail remains recorded", async () => {
    const r = await flat({
      terrainDistance: 10000,
      radialStep: 1,
      maxSamples: 1000,
      maxRays: 12,
    });
    expect(r.evaluatedSamples).toBe(1000);
    expect(r.directions[0].terrain.sampledTo).toBeLessThan(10000);
    expect(r.warnings.some((w) => w.includes("Punktbudget"))).toBe(true);
  });
  test("abort stops computation", async () => {
    const c = new AbortController();
    c.abort();
    await expect(
      analyzeHorizon(
        synthetic(() => 100),
        inputs,
        () => {},
        "fixture",
        c.signal,
      ),
    ).rejects.toThrow();
  });
  test("preflight does not invent bytes", () => {
    expect(preflight(inputs).bytes).toBeNull();
    expect(preflight(inputs).tileUpperBound).toBeGreaterThan(0);
  });
  test.each([
    "terrainDistance",
    "relativeHeight",
    "maxSamples",
    "terrainK",
    "minAltitude",
  ] as const)("reject nonfinite %s", (key) =>
    expect(() => validateHorizonInputs({ ...inputs, [key]: NaN })).toThrow(),
  );
  test("reject nonintegral budgets", () =>
    expect(() =>
      validateHorizonInputs({ ...inputs, maxRays: 12.5 }),
    ).toThrow());
});
describe("versioned scientific and NINA export", () => {
  test("JSON exact numerical round trip", async () => {
    const r = await flat();
    expect(importHorizonJSON(exportHorizonJSON(r))).toEqual(r);
  });
  test.each(["schema", "actual", "azimuth", "coverage", "planning"])(
    "reject corrupted %s",
    async (kind) => {
      const r = await flat();
      if (kind === "schema")
        (r as unknown as { schema: string }).schema = "future";
      if (kind === "actual") r.directions[0].actual = 0;
      if (kind === "planning") r.directions[0].planning = 0;
      if (kind === "azimuth") r.directions[1].azimuth = 0;
      if (kind === "coverage") r.directions[0].terrain.status = "UNKNOWN";
      expect(() => importHorizonJSON(exportHorizonJSON(r))).toThrow();
    },
  );
  test("NINA requires explicit provisional consent", async () =>
    expect(() => exportNina(awaitableResult)).toThrow());
  test("a complete angular lattice of sampled rays still cannot certify NINA interpolation", async () => {
    const r = await flat();
    for (const planning of [false, true])
      expect(() => exportNina(r, planning, true)).toThrow(
        "UNCERTIFIED_SPATIAL_COVERAGE",
      );
  });
  test("CSV null remains empty, with units/status", async () => {
    const r = await analyzeHorizon(
      synthetic(() => NaN),
      inputs,
    );
    const csv = exportHorizonCSV(r);
    expect(csv).toContain('"UNKNOWN"');
    expect(csv).toContain('"azimuth_deg"');
    expect(csv).not.toContain("NaN");
  });
});
// Consent rejection precedes inspection of the object, so no fabricated valid result.
const awaitableResult = {} as HorizonResult;
