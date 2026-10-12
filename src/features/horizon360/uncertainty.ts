import type { HorizonInputs } from "./types";
import type { CellSource, SourceCellAudit } from "./raster-sectors";
import { auditCellSource } from "./raster-sectors";
import { toUTM } from "../../core/geo";

export type SpatialAudit = {
  status: "CONDITIONAL_MODEL_ONLY";
  physicalValidation: "NOT_MEASURED";
  eyeRange: [number, number] | null;
  observerRadius: number;
  groundRange: [number, number] | null;
  groundTraversalComplete: boolean;
  terrain?: SourceCellAudit;
  surface?: SourceCellAudit;
  errors: string[];
};
/** Interval propagation over the ENTIRE declared disk, not a finite point ensemble. */
export async function propagateAndAudit(
  source: CellSource,
  i: HorizonInputs,
  nominalGround: number,
  maxCells: number,
  signal?: AbortSignal,
): Promise<SpatialAudit> {
  const [x, y] = toUTM(i.observer),
    observerRadius = i.positionUncertainty + (i.opticalHorizontalMotion ?? 0);
  const result: SpatialAudit = {
    status: "CONDITIONAL_MODEL_ONLY",
    physicalValidation: "NOT_MEASURED",
    eyeRange: null,
    observerRadius,
    groundRange: null,
    groundTraversalComplete: false,
    errors: [],
  };
  let groundMin = nominalGround,
    groundMax = nominalGround,
    groundValid = true,
    used = 0;
  if (i.absoluteEyeHeight === undefined && observerRadius > 0) {
    const stream = source.stream("dgm1", x, y, observerRadius + 1);
    for await (const cell of stream.cells) {
      signal?.throwIfAborted();
      if (used >= maxCells) {
        groundValid = false;
        result.errors.push("GROUND_CELL_BUDGET");
        break;
      }
      used++;
      if (
        cell.height === null ||
        !Number.isFinite(cell.height) ||
        cell.height < -100 ||
        cell.height > 4000
      )
        groundValid = false;
      else {
        groundMin = Math.min(groundMin, cell.height);
        groundMax = Math.max(groundMax, cell.height);
      }
    }
    groundValid &&= used > 0 && stream.complete() && stream.errors.length === 0;
    result.errors.push(...stream.errors);
  }
  result.groundTraversalComplete = groundValid;
  if (!groundValid) {
    result.errors.push("OBSERVER_GROUND_RANGE_UNKNOWN");
    return result;
  }
  result.groundRange = [groundMin, groundMax];
  const error = i.verticalUncertainty;
  const groundError =
    i.absoluteEyeHeight === undefined ? (i.terrainHeightError ?? 0) : 0;
  const eyeMin =
    (i.absoluteEyeHeight ?? groundMin + i.relativeHeight) -
    groundError -
    error -
    (i.opticalHeightBelow ?? 0);
  const eyeMax =
    (i.absoluteEyeHeight ?? groundMax + i.relativeHeight) +
    groundError +
    error +
    (i.opticalHeightAbove ?? 0);
  result.eyeRange = [eyeMin, eyeMax];
  const count = Math.ceil(360 / i.initialAzimuthStep);
  const conditions = {
    observerX: x,
    observerY: y,
    observerRadius,
    eyeMin,
    eyeMax,
  };
  result.terrain = await auditCellSource(
    source.stream("dgm1", x, y, i.terrainDistance + observerRadius),
    i.terrainDistance + observerRadius,
    { ...conditions, heightError: i.terrainHeightError ?? 0, k: i.terrainK },
    count,
    Math.max(0, maxCells - used),
    signal,
  );
  used += result.terrain.evaluatedCells;
  if (i.surfaceDistance)
    result.surface = await auditCellSource(
      source.stream("dom20", x, y, i.surfaceDistance + observerRadius),
      i.surfaceDistance + observerRadius,
      { ...conditions, heightError: i.surfaceHeightError ?? 0, k: i.surfaceK },
      count,
      Math.max(0, maxCells - used),
      signal,
    );
  result.errors.push(
    ...result.terrain.errors,
    ...(result.surface?.errors ?? []),
  );
  return result;
}
