import { openDB } from "idb";
import type { TileRecord, Analysis, Inputs } from "../core/types";
export type CacheEntry = { data: ArrayBuffer; metadata: TileRecord };
export interface TileCache {
  get(key: string): Promise<CacheEntry | undefined>;
  put(key: string, entry: CacheEntry): Promise<void>;
  clear(): Promise<void>;
}
export class BrowserCache implements TileCache {
  constructor(private algorithm = "native-blocks-v1") {}
  private db = openDB("horizon-elevation-v1", 1, {
    upgrade(db) {
      db.createObjectStore("tiles");
    },
  });
  async get(key: string) {
    return (await this.db).get("tiles", key) as Promise<CacheEntry | undefined>;
  }
  async put(key: string, value: CacheEntry) {
    await (await this.db).put("tiles", value, key);
  }
  async clear() {
    await (await this.db).clear("tiles");
  }
  private analysisKey(inputs: Inputs, commit: string) {
    return (
      "@analysis:" +
      this.algorithm +
      ":" +
      commit +
      ":" +
      JSON.stringify(inputs)
    );
  }
  async getAnalysis(
    inputs: Inputs,
    commit: string,
  ): Promise<{ analysis: Analysis; bytesRead: number } | undefined> {
    const db = await this.db;
    const analysis = (await db.get(
      "tiles",
      this.analysisKey(inputs, commit),
    )) as Analysis | undefined;
    if (!analysis?.tiles?.length) return undefined;
    let bytesRead = 0;
    // Read one source at a time. This intentionally validates against the
    // existing v1 store, including imports made by an older open app tab.
    // No database upgrade can block or disturb that tab's running analysis.
    for (const source of analysis.tiles) {
      if (!source.sha256) return undefined;
      const current = await this.get(source.model + ":" + source.id);
      if (
        !current ||
        current.metadata.sha256 !== source.sha256 ||
        current.metadata.source !== source.source ||
        (current.metadata.state === "Local") !== (source.state === "Local")
      )
        return undefined;
      bytesRead += current.data.byteLength;
    }
    return { analysis, bytesRead };
  }
  async putAnalysis(analysis: Analysis) {
    const db = await this.db;
    await db.put(
      "tiles",
      analysis,
      this.analysisKey(analysis.inputs, analysis.commit),
    );
    // Keep at most three exact-input results. Raw elevation tiles are untouched.
    const currentKey = this.analysisKey(analysis.inputs, analysis.commit);
    const keys = (await db.getAllKeys("tiles")).filter(
      (k) =>
        typeof k === "string" && k.startsWith("@analysis:") && k !== currentKey,
    );
    for (const key of keys.slice(0, Math.max(0, keys.length - 2)))
      await db.delete("tiles", key);
  }
}
export class MemoryCache implements TileCache {
  values = new Map<string, CacheEntry>();
  async get(key: string) {
    return this.values.get(key);
  }
  async put(key: string, value: CacheEntry) {
    this.values.set(key, value);
  }
  async clear() {
    this.values.clear();
  }
}
