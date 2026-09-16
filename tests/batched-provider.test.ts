import { describe, it, expect } from "vitest";
import "fake-indexeddb/auto";
import { MemoryCache, BrowserCache } from "../src/data/cache";
import { BavarianProvider } from "../src/data/provider";
import { BatchedProvider } from "../src/data/batched-provider";
import { fixtureTIFF } from "./fixtures";
import { tiledFixture } from "./tiled-fixture";
import { analyze, profile } from "../src/core/engine";
import {
  analyze as referenceAnalyze,
  profile as referenceProfile,
} from "./reference/engine-v0.8.1";
import type { Inputs, TileRecord, Model } from "../src/core/types";
import type { ElevationProvider } from "../src/data/provider";

const inputs: Inputs = {
  observer: { lat: 48.2, lon: 11.6 },
  observerHeight: 1.6,
  azimuth: 90,
  distance: 1000,
  step: 1,
  model: "dom20",
  domMode: "full",
  date: "2026-09-16",
  timezone: "Europe/Berlin",
  atmosphere: {
    k: 0.13,
    solarRefraction: true,
    pressure: 1010,
    temperature: 10,
  },
  mode: "sunrise",
  azimuthStep: 0.5,
  fanHalfWidth: 4,
  proxy: "",
  groundOffset: 0,
  positionUncertainty: 0,
};
const metadata = (id: string): TileRecord => ({
  id,
  model: "dgm1",
  source: "TEST / FIXTURE",
  state: "Local",
  bytes: 0,
  sha256: "fixture",
  downloadedAt: "2026-09-16",
});
describe("batched native raster access", () => {
  it("reads exact native pixels across internal blocks and partial edge blocks", async () => {
    const cache = new MemoryCache();
    await cache.put("dgm1:600_5400", {
      data: tiledFixture("600_5400"),
      metadata: metadata("600_5400"),
    });
    const fail = async () => {
      throw new Error("Unexpected network");
    };
    const old = new BavarianProvider(cache, () => {}, fail),
      fast = new BatchedProvider(cache, () => {}, fail);
    const points: [number, number][] = [
      [600127.75, 5400872.25],
      [600500.25, 5400500.25],
      [600998.75, 5400001.25],
      [600127.75, 5400872.25],
    ];
    expect(await fast.sampleMany(points, "dgm1")).toEqual(
      await old.sampleMany(points, "dgm1"),
    );
    expect(fast.stats.blocksDecoded).toBeLessThan(10);
    const before = fast.stats.blocksDecoded;
    await fast.sampleMany(points, "dgm1");
    expect(fast.stats.blocksDecoded).toBe(before);
  });
  it("preserves NoData errors and zero-weight NoData behavior", async () => {
    const cache = new MemoryCache();
    await cache.put("dgm1:600_5400", {
      data: tiledFixture("600_5400", 256, 128, true),
      metadata: metadata("600_5400"),
    });
    for (const p of [new BavarianProvider(cache), new BatchedProvider(cache)]) {
      expect(await p.sampleMany([[600000.5, 5400999.5]], "dgm1")).toEqual([
        300,
      ]);
      await expect(
        p.sampleMany([[600000.75, 5400999.5]], "dgm1"),
      ).rejects.toThrow("NoData");
    }
  });
  it("continues using an in-memory file when persistent storage fails", async () => {
    const cache = {
      async get() {
        return undefined;
      },
      async put() {
        throw new Error("quota");
      },
      async clear() {},
    };
    let downloads = 0;
    const p = new BatchedProvider(
      cache,
      () => {},
      async (_model, id) => {
        downloads++;
        return { data: fixtureTIFF(id), metadata: metadata(id) };
      },
    );
    await p.sampleMany([[600500, 5400500]], "dgm1");
    expect(p.stats.cacheWriteFailures).toBe(1);
    expect(downloads).toBe(1);
    // Same in-memory file remains usable despite the storage failure.
    await p.sampleMany([[600600, 5400500]], "dgm1");
    expect(downloads).toBe(1);
  });
  it("matches legacy values exactly across seams, unordered queries and duplicates", async () => {
    const cache = new MemoryCache();
    for (const id of ["600_5400", "601_5400", "600_5401", "601_5401"])
      await cache.put("dgm1:" + id, {
        data: fixtureTIFF(id),
        metadata: metadata(id),
      });
    const fail = async () => {
      throw new Error("Unexpected network");
    };
    const old = new BavarianProvider(cache, () => {}, fail),
      fast = new BatchedProvider(cache, () => {}, fail);
    const points: [number, number][] = [
      [600999.75, 5400999.75],
      [601000.25, 5401000.25],
      [600050.5, 5400020.5],
      [600999.75, 5400999.75],
      [600050.75, 5400020.75],
    ];
    const expected = await old.sampleMany(points, "dgm1");
    const actual = await Promise.all([
      fast.sampleMany(points, "dgm1"),
      fast.sampleMany([...points].reverse(), "dgm1"),
    ]);
    expect(actual[0]).toEqual(expected);
    expect(actual[1]).toEqual([...expected].reverse());
    expect(fast.stats.fileOpens).toBe(4);
    expect(fast.stats.blocksDecoded).toBe(4);
    // These particular fixtures use a single full-image strip.
    expect(fast.stats.fullRasterDecodes).toBe(4);
  });
  it("rejects invalid raster metadata without a silent fallback", async () => {
    const cache = new MemoryCache();
    await cache.put("dgm1:600_5400", {
      data: fixtureTIFF("601_5400"),
      metadata: metadata("600_5400"),
    });
    await expect(
      new BatchedProvider(cache).sampleMany([[600500, 5400500]], "dgm1"),
    ).rejects.toThrow("Kachel-ID");
  });
});
describe("unchanged scientific calculations", () => {
  const make = (batch: boolean): ElevationProvider => ({
    records: new Map(),
    ...(batch ? { batch: async <T>(f: () => Promise<T>) => f() } : {}),
    async sampleMany(points, model: Model) {
      return points.map(
        ([x, y]) =>
          300 +
          Math.sin(x / 17) * 3 +
          Math.cos(y / 21) * 2 +
          (model === "dom20" ? Math.max(0, Math.sin(x / 3) * 15) : 0),
      );
    },
  });
  it.each(["dgm1", "dom20"] as const)(
    "preserves the entire %s solar result including adaptive profiles",
    async (model) => {
      const i = { ...inputs, model };
      const a = await referenceAnalyze(make(false), i, () => {}, "test"),
        b = await analyze(make(true), i, () => {}, "test");
      expect(b.profile).toEqual(a.profile);
      expect(b.horizon).toEqual(a.horizon);
      expect(b.contact).toEqual(a.contact);
      expect(b.standardSunrise).toEqual(a.standardSunrise);
      expect(b.sensitivity).toEqual(a.sensitivity);
      expect(b.warnings).toEqual(a.warnings);
    },
  );
  it.each(["full", "critical"] as const)(
    "preserves %s DOM coverage, ties and all profile points",
    async (domMode) => {
      const i = { ...inputs, domMode };
      expect(await profile(make(true), i)).toEqual(
        await referenceProfile(make(false), i),
      );
    },
  );
  it("invalidates saved results on source replacement, inputs, commit and clear", async () => {
    const cache = new BrowserCache();
    await cache.clear();
    const a = await analyze(
      make(true),
      { ...inputs, mode: "los" },
      () => {},
      "test",
    );
    a.tiles = [metadata("600_5400")];
    await cache.put("dgm1:600_5400", {
      data: new ArrayBuffer(8),
      metadata: a.tiles[0],
    });
    await cache.putAnalysis(a);
    expect(
      await new BrowserCache("changed-algorithm").getAnalysis(a.inputs, "test"),
    ).toBeUndefined();
    expect(
      (await cache.getAnalysis(a.inputs, "test"))?.analysis.profile,
    ).toEqual(a.profile);
    expect(
      await cache.getAnalysis({ ...a.inputs, observerHeight: 2 }, "test"),
    ).toBeUndefined();
    expect(await cache.getAnalysis(a.inputs, "other-commit")).toBeUndefined();
    await cache.put("dgm1:600_5400", {
      data: new ArrayBuffer(8),
      metadata: { ...a.tiles[0], sha256: "changed" },
    });
    expect(await cache.getAnalysis(a.inputs, "test")).toBeUndefined();
    await cache.clear();
    expect(await cache.getAnalysis(a.inputs, "test")).toBeUndefined();
  });
});
