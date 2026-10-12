import type { Position, TileRecord, PerformanceStats } from "../../core/types";

export type Coverage = "UNKNOWN" | "INCOMPLETE";
export type HorizonInputs = {
  observer: Position;
  mode: "FAST" | "DETAIL";
  relativeHeight: number;
  absoluteEyeHeight?: number;
  terrainDistance: number;
  surfaceDistance: number;
  terrainK: number;
  surfaceK: number;
  minAltitude: number;
  margin: number;
  positionUncertainty: number;
  verticalUncertainty: number;
  initialAzimuthStep: number;
  minimumAzimuthStep: number;
  radialStep: number;
  refinementTolerance: number;
  maxRays: number;
  maxSamples: number;
  maxTiles: number;
  maxArchiveBytes: number;
};
export type Blocker = Position & {
  distance: number;
  height: number;
  angle: number;
  model: "dgm1" | "dom20";
  tile: string;
};
export type SourceScan = {
  status: Coverage;
  requestedDistance: number;
  sampledTo: number;
  maxRadialGap: number;
  attempted: number;
  valid: number;
  blocker: Blocker | null;
  errors: string[];
};
export type HorizonDirection = {
  azimuth: number;
  terrain: SourceScan;
  surface: SourceScan;
  actual: number | null;
  planning: number | null;
  status: Coverage;
  nextAngularGap: number;
};
export type HorizonResult = {
  schema: "astro360-1";
  method: "adaptive-rays-v1";
  commit: string;
  timestamp: string;
  inputs: HorizonInputs;
  ground: number;
  eye: number;
  directions: HorizonDirection[];
  tiles: TileRecord[];
  warnings: string[];
  elapsedMs: number;
  evaluatedSamples: number;
  preflight: { tileUpperBound: number; bytes: null };
  performance?: PerformanceStats;
};
export const horizonDefaults: HorizonInputs = {
  observer: { lat: 48.14, lon: 11.58 },
  mode: "FAST",
  relativeHeight: 1.6,
  terrainDistance: 1000,
  surfaceDistance: 100,
  terrainK: 0.13,
  surfaceK: 0.13,
  minAltitude: 30,
  margin: 0,
  positionUncertainty: 0,
  verticalUncertainty: 0,
  initialAzimuthStep: 10,
  minimumAzimuthStep: 1,
  radialStep: 10,
  refinementTolerance: 0.1,
  maxRays: 144,
  maxSamples: 100000,
  maxTiles: 20,
  maxArchiveBytes: 256 * 1024 * 1024,
};
