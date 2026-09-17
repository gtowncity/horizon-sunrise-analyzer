import { describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { openDB } from "idb";
import { BrowserCache, MemoryCache } from "../src/data/cache";
import { BatchedProvider } from "../src/data/batched-provider";
import { BavarianProvider, openTile } from "../src/data/provider";
import { tiledFixture } from "./tiled-fixture";
import type { TileRecord } from "../src/core/types";

const metadata: TileRecord = {
  id: "600_5400",
  model: "dgm1",
  source: "fixture",
  state: "Local",
  bytes: 0,
  sha256: "original",
  downloadedAt: "test",
};
const key = "dgm1:600_5400";
const fail = async (): Promise<never> => {
  throw new Error("Unexpected download");
};

describe("lossless range access", () => {
  it("matches complete buffers across sections, duplicate points and edge blocks", async () => {
    const data = tiledFixture(metadata.id);
    const cache = new MemoryCache();
    await cache.put(key, { data, metadata });
    const original = new BatchedProvider(cache, () => {}, fail);
    const ranges = new BatchedProvider(
      {
        get: fail,
        async getSource() {
          return { data: new Blob([data]), metadata };
        },
        put: fail,
        clear: fail,
      },
      () => {},
      fail,
    );
    const points: [number, number][] = Array.from({ length: 20001 }, (_, j) =>
      j % 2 ? [600127.75, 5400872.25] : [600998.75, 5400001.25],
    );
    const expected = await original.sampleMany(points, "dgm1");
    expect(expected).toEqual(
      await new BavarianProvider(cache, () => {}, fail).sampleMany(
        points,
        "dgm1",
      ),
    );
    const actual = await Promise.all([
      ranges.sampleMany(points, "dgm1"),
      ranges.sampleMany([...points].reverse(), "dgm1"),
    ]);
    expect(actual).toEqual([expected, [...expected].reverse()]);
    expect(ranges.stats.cacheReadBytes).toBeLessThan(data.byteLength);
    expect(ranges.stats.blocksDecoded).toBe(original.stats.blocksDecoded);
  });

  it("preserves Blob metadata validation and rejects corrupt or unreadable data", async () => {
    await expect(
      openTile({ data: new Blob([new Uint8Array(64)]), metadata }),
    ).rejects.toThrow("Ungültige GeoTIFF");
    await expect(
      openTile({ data: new Blob([tiledFixture("601_5400")]), metadata }),
    ).rejects.toThrow("Kachel-ID");
    class UnreadableBlob extends Blob {
      override slice() {
        return new UnreadableBlob();
      }
      override async arrayBuffer(): Promise<ArrayBuffer> {
        throw new Error("I/O failure");
      }
    }
    await expect(
      openTile({ data: new UnreadableBlob(), metadata }),
    ).rejects.toThrow("Ungültige GeoTIFF");
  });

  it("preserves every pixel across range pages and fails on a later read error", async () => {
    const data = tiledFixture(metadata.id);
    const buffered = await openTile({ data: new Blob([data]), metadata });
    const full = await openTile({ data, metadata });
    const options = { samples: [0], interleave: true };
    expect(await buffered.image.readRasters(options)).toEqual(
      await full.image.readRasters(options),
    );
    class DamagedBlob extends Blob {
      override slice(start = 0, end?: number) {
        if (start >= 256 * 1024) throw new Error("source read failed");
        return super.slice(start, end);
      }
    }
    const provider = new BatchedProvider(
      {
        get: fail,
        async getSource() {
          return { data: new DamagedBlob([data]), metadata };
        },
        put: fail,
        clear: fail,
      },
      () => {},
      fail,
    );
    await expect(
      provider.sampleMany([[600998.75, 5400001.25]], "dgm1"),
    ).rejects.toThrow("source read failed");
  });

  it("retains v1 legacy precedence and full-buffer compatibility", async () => {
    const cache = new BrowserCache();
    await cache.clear();
    const first = new Uint8Array([1, 2, 3]).buffer;
    await cache.put(key, { data: first, metadata });
    expect((await cache.getSource(key))?.data).toBeInstanceOf(Blob);
    expect((await cache.get(key))?.data).toEqual(first);
    const db = await openDB("horizon-elevation-v1", 1);
    const replacement = {
      data: new Uint8Array([4, 5]).buffer,
      metadata: { ...metadata, sha256: "replacement" },
    };
    await db.put("tiles", replacement, key);
    expect(await cache.getSource(key)).toEqual(replacement);
    expect(await cache.get(key)).toEqual(replacement);
    await cache.clear();
    expect(await cache.getSource(key)).toBeUndefined();
    db.close();
  });
});
