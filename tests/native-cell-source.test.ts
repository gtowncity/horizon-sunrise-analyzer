import { expect, test } from "vitest";
import { NativeCellSource } from "../src/features/horizon360/cell-source";
import { fixtureTIFF } from "./fixtures";
import type { TileCache, CacheEntry } from "../src/data/cache";
test("native footprint traversal uses independent raw pixel values and includes boundary cells", async () => {
  const data = fixtureTIFF("691_5334");
  const entry: CacheEntry = {
    data,
    metadata: {
      id: "691_5334",
      model: "dgm1",
      source: "SYNTHETIC_INDEPENDENT_PLANE",
      state: "Local",
      bytes: data.byteLength,
      downloadedAt: "2026-10-12T00:00:00Z",
    },
  };
  const cache: TileCache = {
    get: async () => entry,
    put: async () => {},
    clear: async () => {},
  };
  const source = new NativeCellSource(cache, async () => {
    throw new Error("Unexpected remote fetch");
  });
  const s = source.stream("dgm1", 691500, 5334500, 2);
  let count = 0;
  for await (const c of s.cells) {
    count++;
    expect(c.size).toBe(2);
    expect(c.pixelResolution).toBe(1);
    expect(c.height).toBeCloseTo(
      300 + (c.x - 691000) * 0.001 + (c.y - 5334000) * 0.002,
      4,
    );
    expect(c.tile).toBe("691_5334");
  }
  expect(s.complete()).toBe(true);
  expect(s.errors).toEqual([]);
  expect(count).toBeGreaterThan(12);
  expect(source.metrics.blocksDecoded).toBeGreaterThan(0);
});
test("native cell source failure cannot certify a complete disk", async () => {
  const cache: TileCache = {
    get: async () => undefined,
    put: async () => {},
    clear: async () => {},
  };
  const source = new NativeCellSource(cache, async () => {
    throw new Error("Official source unavailable");
  });
  const s = source.stream("dgm1", 691500, 5334500, 2);
  const cells = [];
  for await (const c of s.cells) cells.push(c);
  expect(cells).toEqual([]);
  expect(s.complete()).toBe(false);
  expect(s.errors).toContain("Official source unavailable");
});
