import { expect, test } from "vitest";
import { analyzeHorizon } from "../src/features/horizon360/engine";
import { exportNina } from "../src/features/horizon360/export";
import { horizonDefaults } from "../src/features/horizon360/types";
import { fromUTM, inverse } from "../src/core/geo";
import type { ElevationProvider } from "../src/data/provider";

test("NINA denies physical and planning export after budget leaves 240 degrees uninvestigated", async () => {
  const provider: ElevationProvider = {
    records: new Map(),
    sampleMany: async (points) => points.map(() => 100),
  };
  const r = await analyzeHorizon(provider, {
    ...horizonDefaults,
    surfaceDistance: 0,
    terrainDistance: 200,
    radialStep: 1,
    initialAzimuthStep: 30,
    maxSamples: 1000,
  });
  expect(r.directions.map((d) => d.azimuth)).toEqual([0, 30, 60, 90, 120]);
  expect(r.directions.at(-1)?.nextAngularGap).toBe(240);
  expect(r.directions.every((d) => d.actual !== null)).toBe(true);
  for (const planning of [false, true])
    expect(() => exportNina(r, planning, true)).toThrow();
});

test("NINA denies partially successful radial batches even when every ray has numeric blockers", async () => {
  const provider: ElevationProvider = {
    records: new Map(),
    sampleMany: async (points) => {
      const distances = points.map(
        ([x, y]) => inverse(horizonDefaults.observer, fromUTM(x, y)).distance,
      );
      if (distances.some((d) => d > 512.1))
        throw new Error("Independent failed radial batch fixture");
      return points.map(() => 100);
    },
  };
  const r = await analyzeHorizon(provider, {
    ...horizonDefaults,
    surfaceDistance: 0,
    terrainDistance: 1000,
    radialStep: 1,
    initialAzimuthStep: 30,
    maxRays: 12,
  });
  expect(r.directions).toHaveLength(12);
  expect(
    r.directions.every(
      (d) =>
        d.terrain.valid > 0 &&
        d.terrain.errors.length > 0 &&
        d.terrain.sampledTo < 1000,
    ),
  ).toBe(true);
  for (const planning of [false, true])
    expect(() => exportNina(r, planning, true)).toThrow();
});
