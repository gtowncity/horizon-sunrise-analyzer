import { describe, it, expect } from "vitest";
import {
  apparentAngle,
  curvatureDrop,
  normalRadius,
  toUTM,
  fromUTM,
  tileId,
  corridorTiles,
  destination,
  inverse,
} from "../src/core/geo";
import { bilinear, gridCoordinates } from "../src/core/raster";
import {
  diskMargin,
  bisectFirst,
  horizonAt,
  localDay,
  solarRefraction,
  standardSunrise,
  sun,
} from "../src/core/solar";
import { horizonMaximum, profile, analyze } from "../src/core/engine";
import { exportCSV, exportJSON, importJSON } from "../src/core/export";
import type {
  HorizonPoint,
  Inputs,
  Sample,
  SolarPosition,
} from "../src/core/types";
import type { ElevationProvider } from "../src/data/provider";
const atmosphere = {
  k: 0,
  solarRefraction: false,
  pressure: 1010,
  temperature: 10,
};
const point = { lat: 48, lon: 9 };
const input: Inputs = {
  observer: point,
  observerHeight: 1.6,
  azimuth: 90,
  distance: 1000,
  step: 1,
  model: "dgm1",
  domMode: "full",
  date: "2026-03-20",
  timezone: "Europe/Berlin",
  atmosphere,
  mode: "los",
  azimuthStep: 0.1,
  fanHalfWidth: 4,
  proxy: "",
  groundOffset: 0,
  positionUncertainty: 0,
};
const sample = (distance: number, angle: number): Sample => ({
  lat: 48,
  lon: 9,
  distance,
  terrain: 300,
  angle,
  drop: 0,
  tile: "500_5316",
});
const horizon = (points: number[][]): HorizonPoint[] =>
  points.map(([azimuth, angle]) => ({
    azimuth,
    angle,
    blocker: sample(1000, angle),
  }));
const solar: SolarPosition = {
  azimuth: 90,
  altitude: 0,
  apparentAltitude: 0,
  radius: 0.266,
  distanceAU: 1,
  declination: 0,
};
const flat: ElevationProvider = {
  records: new Map(),
  async sampleMany(ps, model) {
    return ps.map(() => (model === "dgm1" ? 300 : 310));
  },
};
describe("geodesy and coordinates", () => {
  it("UTM central meridian has exactly 500 km easting", () =>
    expect(toUTM(point)[0]).toBeCloseTo(500000, 6));
  it.each([
    { lat: 47.5, lon: 10 },
    { lat: 49, lon: 13.8 },
    { lat: 50, lon: 9.5 },
  ])("round-trip $lat $lon", (p) => {
    const q = fromUTM(...toUTM(p));
    expect(q.lat).toBeCloseTo(p.lat, 8);
    expect(q.lon).toBeCloseTo(p.lon, 8);
  });
  it("tile IDs honor floor at boundaries", () => {
    expect(tileId(600999.999, 5401000)).toBe("600_5401");
    expect(tileId(601000, 5400999.999)).toBe("601_5400");
  });
  it.each([1, 1000, 50000, 80000])("ellipsoidal direct/inverse %d m", (d) => {
    const q = destination(point, 86, d),
      v = inverse(point, q);
    expect(v.distance).toBeCloseTo(d, 5);
    expect(v.azimuth).toBeCloseTo(86, 6);
  });
  it("supercover contains densely sampled sector including boundary halo", () => {
    const tiles = new Set(corridorTiles(point, 85, 89, 2000));
    for (let a = 85; a <= 89; a += 0.25)
      for (let d = 0; d < 2000; d += 31)
        expect(tiles.has(tileId(...toUTM(destination(point, a, d))))).toBe(
          true,
        );
  });
});
describe("raster interpolation", () => {
  it.each([
    [0, 0, 10],
    [1, 0, 20],
    [0, 1, 30],
    [1, 1, 40],
    [0.5, 0.5, 25],
    [0.2, 0.8, 28],
  ])("bilinear at %f %f", (x, y, value) =>
    expect(bilinear([10, 20, 30, 40], x, y)).toBeCloseTo(value, 10),
  );
  it("NoData contributes only at nonzero weight", () => {
    expect(bilinear([10, -9999, -9999, -9999], 0, 0)).toBe(10);
    expect(() => bilinear([10, -9999, 30, 40], 0.5, 0.5)).toThrow("NoData");
    expect(() => bilinear([10, NaN, 30, 40], 0.5, 0.5)).toThrow("NoData");
  });
  it("PixelIsArea center offset is half a pixel", () => {
    expect(gridCoordinates(600000.5, 5400999.5, 600000, 5401000, 1)).toEqual({
      col: 0,
      row: 0,
      fx: 0,
      fy: 0,
    });
    expect(gridCoordinates(600000, 5401000, 600000, 5401000, 1)).toEqual({
      col: -1,
      row: -1,
      fx: 0.5,
      fy: 0.5,
    });
  });
});
describe("curvature and atmospheric separation", () => {
  it("40 km drop is about 125 m", () =>
    expect(curvatureDrop(40000, 6371000)).toBeCloseTo(125.56898, 4));
  it.each([0, 0.07, 0.13, 0.2])("effective radius k=%f", (k) => {
    expect(curvatureDrop(50000, 6371000, k)).toBeCloseTo(
      (1 - k) * 196.201538,
      5,
    );
  });
  it("long flat terrain matches half-angle exact solution", () =>
    expect(apparentAngle(50000, 0, 0, 6371000, 0)).toBeCloseTo(
      ((-50000 / 6371000 / 2) * 180) / Math.PI,
      10,
    ));
  it("short distance avoids cancellation", () =>
    expect(apparentAngle(0.01, 301, 300, 6371000)).toBeCloseTo(
      (Math.atan2(1, 0.01000047) * 180) / Math.PI,
      6,
    ));
  it("more observer height reduces angle; higher k increases it", () => {
    const R = normalRadius(49, 90);
    expect(apparentAngle(40000, 1000, 400, R)).toBeLessThan(
      apparentAngle(40000, 1000, 300, R),
    );
    expect(apparentAngle(40000, 1000, 300, R, 0.2)).toBeGreaterThan(
      apparentAngle(40000, 1000, 300, R, 0),
    );
  });
  it("NOAA correction at 0° and pressure scaling", () => {
    expect(solarRefraction(0)).toBeCloseTo(1735 / 3600, 10);
    expect(solarRefraction(0, 505)).toBeCloseTo(solarRefraction(0) / 2, 10);
    expect(solarRefraction(90)).toBe(0);
  });
});
describe("horizon, disk and time", () => {
  it("equal maxima preserve the first original sample", () => {
    const a = sample(10, 1),
      b = sample(20, 1);
    expect(horizonMaximum([a, b])).toBe(a);
    expect(horizonMaximum([b, a])).toBe(b);
  });
  it("maximum is angle, not absolute altitude", () =>
    expect(
      horizonMaximum([sample(10, 1), { ...sample(1000, 0.5), terrain: 1000 }])
        .distance,
    ).toBe(10));
  it("competing and boundary peaks choose larger angle", () =>
    expect(
      horizonMaximum([sample(999, 1), sample(1000, 1.1), sample(1001, 1.05)])
        .distance,
    ).toBe(1000));
  it("H(A) interpolates and refuses extrapolation", () => {
    expect(
      horizonAt(
        horizon([
          [89, 1],
          [90, 2],
        ]),
        89.25,
      ),
    ).toBe(1.25);
    expect(() =>
      horizonAt(
        horizon([
          [89, 1],
          [90, 2],
        ]),
        91,
      ),
    ).toThrow();
  });
  it("flat tangent solar disk has zero margin", () =>
    expect(
      diskMargin(
        solar,
        horizon([
          [89, 0.266],
          [91, 0.266],
        ]),
        atmosphere,
      ).margin,
    ).toBeCloseTo(0, 10));
  it("a side notch exposes the disk before its central limb", () => {
    const h = horizon([
      [89, 1],
      [90, 1],
      [90.19, 1],
      [90.2, 0],
      [90.21, 1],
      [91, 1],
    ]);
    expect(diskMargin(solar, h, atmosphere).margin).toBeGreaterThan(0.15);
    expect(solar.radius - horizonAt(h, 90)).toBeLessThan(0);
  });
  it("narrow notch between sampled limb points is captured by horizon knots", () => {
    const h = horizon([
      [89, 1],
      [90.1229, 1],
      [90.123, 0],
      [90.1231, 1],
      [91, 1],
    ]);
    expect(diskMargin(solar, h, atmosphere, 24).margin).toBeGreaterThan(0.23);
  });
  it("limb discretization converges", () => {
    const h = horizon([
      [89, 0],
      [90, 0.1],
      [91, 0.3],
    ]);
    expect(
      Math.abs(
        diskMargin(solar, h, atmosphere, 720).margin -
          diskMargin(solar, h, atmosphere, 1440).margin,
      ),
    ).toBeLessThan(1e-5);
  });
  it("solver brackets the first crossing below 50 ms", () => {
    const root = bisectFirst((t) => (t - 1234) / 1000, 0, 10000, 1000, 50)!;
    expect(root.time).toBeGreaterThanOrEqual(1234);
    expect(root.time - 1234).toBeLessThan(50);
    expect(root.bracketMs).toBeLessThanOrEqual(50);
  });
  it("solver handles no crossing and does not fabricate one", () =>
    expect(bisectFirst(() => -1, 0, 10000)).toBeNull());
  it("already visible is not mislabeled a contact", () =>
    expect(() => bisectFirst(() => 1, 0, 10000)).toThrow("bereits sichtbar"));
  it.each([
    ["2026-03-29", 23],
    ["2026-10-25", 25],
    ["2026-09-20", 24],
  ])("IANA DST day %s", (date, hours) => {
    const r = localDay(date as string, "Europe/Berlin");
    expect((r.end - r.start) / 3600000).toBe(hours);
  });
  it("invalid dates rejected", () => {
    expect(() => localDay("2026-02-30", "UTC")).toThrow();
    expect(() => localDay("1800-01-01", "UTC")).toThrow();
  });
  it("solar radius varies with distance and season", () => {
    const jan = sun(new Date("2026-01-03T12:00Z"), point, atmosphere),
      jul = sun(new Date("2026-07-04T12:00Z"), point, atmosphere);
    expect(jan.radius).toBeGreaterThan(jul.radius);
    expect(jan.radius).toBeGreaterThan(0.27);
    expect(jul.radius).toBeLessThan(0.263);
  });
  it("equinox standard sunrise in central Europe is plausible", () => {
    const t = standardSunrise("2026-03-20", "Europe/Berlin", point)!;
    expect(new Date(t).getUTCHours()).toBe(5);
  });
});
describe("full profiles and export", () => {
  it("flat terrain horizon follows terrestrial curvature and instrument height", async () => {
    const p = await profile(flat, input);
    expect(p.samples.length).toBe(1001);
    expect(p.blocker.angle).toBeLessThan(0);
    expect(p.blocker.distance).toBe(1000);
  });
  it("DGM and DOM heights are distinct and difference is preserved", async () => {
    const p = await profile(flat, { ...input, model: "dom20" });
    expect(p.samples[20].surface).toBe(310);
    expect(p.samples[20].excess).toBe(10);
    expect(p.surfaceBlocker!.surfaceAngle).toBeGreaterThan(p.blocker.angle);
  });
  it("critical DOM mode cannot claim complete surface coverage", async () => {
    const p = await profile(flat, {
      ...input,
      model: "dom20",
      domMode: "critical",
    });
    expect(p.surfaceComplete).toBe(false);
  });
  it("JSON round trip and CSV carry reproducibility fields", async () => {
    const r = await analyze(flat, input, () => {}, "test");
    expect(importJSON(exportJSON(r))).toEqual(r);
    const csv = exportCSV(r);
    expect(csv).toContain("terrain_m_NHN");
    expect(csv.split("\r\n")).toHaveLength(1002);
    expect(r.commit).toBe("test");
  });
  it("import rejects unrelated and invalid JSON", () => {
    expect(() => importJSON("{}")).toThrow();
    expect(() => importJSON("bad")).toThrow();
  });
});
