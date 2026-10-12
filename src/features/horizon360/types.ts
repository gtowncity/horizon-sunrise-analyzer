import type { Position, TileRecord, PerformanceStats } from "../../core/types";
import type { SpatialAudit } from "./uncertainty";

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
  opticalHorizontalMotion?: number;
  opticalHeightBelow?: number;
  opticalHeightAbove?: number;
  terrainHeightError?: number;
  surfaceHeightError?: number;
  maxCells?: number;
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
  schema: "astro360-1" | "astro360-2" | "astro360-3";
  method: "adaptive-rays-v1" | "adaptive-rays-v2" | "adaptive-rays-v3";
  semantics?: {
    actual: "NOMINAL_SAMPLED_MAXIMUM";
    planning: "NOMINAL_SAMPLED_REFERENCE_NOT_SAFE";
  };
  commit: string;
  algorithm?: string;
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
  spatialAudit?: SpatialAudit;
  cellMetrics?: {
    blocksDecoded: number;
    peakBlockBytes: number;
    sourceOpens: number;
  };
  archiveStreamBytesConsumed?: number;
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
  opticalHorizontalMotion: 0,
  opticalHeightBelow: 0,
  opticalHeightAbove: 0,
  terrainHeightError: 0,
  surfaceHeightError: 0,
  maxCells: 200000,
};
