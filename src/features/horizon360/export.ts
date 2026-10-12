import { validateHorizonInputs } from "./engine";
import type { HorizonResult, HorizonDirection } from "./types";

export function exportHorizonJSON(r: HorizonResult) {
  return JSON.stringify(r, null, 2);
}
export function exportHorizonCSV(r: HorizonResult) {
  const rows: (string | number | null)[][] = [
    [
      "azimuth_deg",
      "terrain_deg",
      "surface_deg",
      "sampled_actual_deg",
      "provisional_planning_deg",
      "status",
      "next_angular_gap_deg",
      "terrain_distance_m",
      "surface_distance_m",
      "terrain_valid",
      "surface_valid",
      "blocker_lat_deg",
      "blocker_lon_deg",
      "blocker_distance_m",
      "blocker_model",
      "blocker_tile",
    ],
  ];
  for (const d of r.directions) {
    const b = selectedBlocker(d);
    rows.push([
      d.azimuth,
      d.terrain.blocker?.angle ?? null,
      d.surface.blocker?.angle ?? null,
      d.actual,
      d.planning,
      d.status,
      d.nextAngularGap,
      d.terrain.sampledTo,
      d.surface.sampledTo,
      d.terrain.valid,
      d.surface.valid,
      b?.lat ?? null,
      b?.lon ?? null,
      b?.distance ?? null,
      b?.model ?? null,
      b?.tile ?? null,
    ]);
  }
  return rows
    .map((row) =>
      row.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(","),
    )
    .join("\r\n");
}
export function selectedBlocker(d: HorizonDirection) {
  const a = d.terrain.blocker,
    b = d.surface.blocker;
  return !a ? b : !b ? a : b.angle > a.angle ? b : a;
}
/** Acknowledgement never grants scientific coverage. No supported result is certified yet. */
export function ninaEligibility(r: HorizonResult): {
  allowed: false;
  reasons: string[];
} {
  const reasons: string[] = [];
  try {
    importHorizonJSON(exportHorizonJSON(r));
  } catch {
    return {
      allowed: false,
      reasons: ["INVALID_RESULT: ungültige oder widersprüchliche Daten"],
    };
  }
  const directions = r.directions;
  if (directions.length < 2 || directions[0].azimuth !== 0)
    reasons.push("UNKNOWN: Nordnaht / Winkelabdeckung fehlt");
  for (const d of directions) {
    if (d.nextAngularGap > r.inputs.initialAzimuthStep + 1e-9)
      reasons.push("UNKNOWN: ununtersuchter Winkelsektor");
    for (const scan of [
      d.terrain,
      ...(r.inputs.surfaceDistance > 0 ? [d.surface] : []),
    ]) {
      if (scan.status === "UNKNOWN" || scan.blocker === null)
        reasons.push("UNKNOWN: angefragte Quelle fehlt");
      if (
        scan.errors.length ||
        scan.valid !== scan.attempted ||
        scan.sampledTo !== scan.requestedDistance
      )
        reasons.push(
          "INCOMPLETE: Radialabfragen fehlgeschlagen oder abgebrochen",
        );
    }
  }
  reasons.push(
    "UNCERTIFIED_SPATIAL_COVERAGE: Strahlen und experimentelle Zellgrenzen belegen keinen kontinuierlichen 360°-Horizont",
  );
  return { allowed: false, reasons: [...new Set(reasons)] };
}
export function exportNina(
  r: HorizonResult,
  _planning = false,
  _acceptIncomplete = false,
): never {
  throw new Error(
    "N.I.N.A.-Export gesperrt: " + ninaEligibility(r).reasons.join("; "),
  );
}
export function importHorizonJSON(text: string): HorizonResult {
  if (text.length > 32 * 1024 * 1024)
    throw new Error("Import größer als 32 MiB");
  const raw = JSON.parse(text);
  if (!(
    (raw?.schema === "astro360-1" && raw.method === "adaptive-rays-v1") ||
    (raw?.schema === "astro360-2" && raw.method === "adaptive-rays-v2") ||
    (raw?.schema === "astro360-3" && raw.method === "adaptive-rays-v3")
  ))
    throw new Error(
      "Nicht unterstützte Schema-/Modellversion; keine implizite Migration",
    );
  validateHorizonInputs(raw.inputs);
  if (
    raw.schema === "astro360-3" &&
    (raw.semantics?.actual !== "NOMINAL_SAMPLED_MAXIMUM" ||
      raw.semantics?.planning !== "NOMINAL_SAMPLED_REFERENCE_NOT_SAFE")
  )
    throw new Error("Unbekannte wissenschaftliche Wertsemantik");
  if (
    !Array.isArray(raw.directions) ||
    raw.directions.length < 1 ||
    raw.directions.length > 720 ||
    !Array.isArray(raw.tiles) ||
    !Array.isArray(raw.warnings) ||
    !raw.warnings.every((w: unknown) => typeof w === "string") ||
    !Number.isFinite(raw.ground) ||
    !Number.isFinite(raw.eye) ||
    typeof raw.commit !== "string" ||
    !Number.isFinite(Date.parse(raw.timestamp)) ||
    !Number.isFinite(raw.elapsedMs) ||
    !Number.isInteger(raw.evaluatedSamples)
  )
    throw new Error("Ungültiges Ergebnis");
  let previous = -1;
  for (const d of raw.directions) {
    if (
      !Number.isFinite(d.azimuth) ||
      d.azimuth < 0 ||
      d.azimuth >= 360 ||
      d.azimuth <= previous ||
      !["UNKNOWN", "INCOMPLETE"].includes(d.status)
    )
      throw new Error("Ungültige Azimutfolge/Coverage");
    previous = d.azimuth;
    for (const [scan, model] of [
      [d.terrain, "dgm1"],
      [d.surface, "dom20"],
    ] as const) {
      if (
        !scan ||
        !["UNKNOWN", "INCOMPLETE"].includes(scan.status) ||
        !Array.isArray(scan.errors) ||
        !scan.errors.every((x: unknown) => typeof x === "string") ||
        ![
          scan.requestedDistance,
          scan.sampledTo,
          scan.maxRadialGap,
          scan.valid,
          scan.attempted,
        ].every(Number.isFinite) ||
        scan.valid < 0 ||
        scan.valid > scan.attempted ||
        scan.sampledTo < 0 ||
        scan.sampledTo > scan.requestedDistance
      )
        throw new Error("Ungültiger Quellscan");
      const b = scan.blocker;
      if (
        b !== null &&
        (!b ||
          b.model !== model ||
          ![b.lat, b.lon, b.angle, b.height, b.distance].every(
            Number.isFinite,
          ) ||
          b.angle < -90 ||
          b.angle > 90 ||
          b.distance <= 0 ||
          b.distance > scan.requestedDistance ||
          !/^\d{3}_\d{4}$/.test(b.tile))
      )
        throw new Error("Ungültiger Blocker");
      if ((b === null) !== (scan.status === "UNKNOWN"))
        throw new Error("Widersprüchliche Quellabdeckung");
    }
    const angles = [d.terrain.blocker?.angle, d.surface.blocker?.angle].filter(
      (v): v is number => v !== undefined,
    );
    const actual = angles.length ? Math.max(...angles) : null;
    if (
      d.actual !== actual ||
      d.planning !==
        (actual === null
          ? null
          : Math.max(actual + raw.inputs.margin, raw.inputs.minAltitude)) ||
      d.status !== (actual === null ? "UNKNOWN" : "INCOMPLETE")
    )
      throw new Error("Widersprüchliche Horizontwerte");
  }
  raw.directions.forEach((d: HorizonDirection, n: number) => {
    const next = raw.directions[(n + 1) % raw.directions.length];
    const gap =
      next.azimuth + (n === raw.directions.length - 1 ? 360 : 0) - d.azimuth;
    if (d.nextAngularGap !== gap)
      throw new Error("Widersprüchliche Winkelabdeckung");
  });
  for (const t of raw.tiles)
    if (
      !t ||
      !["dgm1", "dom20"].includes(t.model) ||
      typeof t.source !== "string" ||
      typeof t.id !== "string" ||
      !Number.isFinite(t.bytes)
    )
      throw new Error("Ungültige Provenienz");
  if (raw.spatialAudit !== undefined) validateSpatialAudit(raw.spatialAudit);
  return raw as HorizonResult;
}

function validateSpatialAudit(raw: unknown) {
  if (typeof raw !== "object" || raw === null)
    throw new Error("Invalid spatial audit");
  const a = raw as NonNullable<HorizonResult["spatialAudit"]>;
  if (
    a.status !== "CONDITIONAL_MODEL_ONLY" ||
    a.physicalValidation !== "NOT_MEASURED" ||
    !Number.isFinite(a.observerRadius) ||
    a.observerRadius < 0 ||
    !Array.isArray(a.errors) ||
    !a.errors.every((e) => typeof e === "string")
  )
    throw new Error("Invalid spatial audit provenance");
  for (const range of [a.eyeRange, a.groundRange])
    if (
      range !== null &&
      (!Array.isArray(range) ||
        range.length !== 2 ||
        !range.every(Number.isFinite) ||
        range[0] > range[1])
    )
      throw new Error("Invalid interval");
  for (const s of [a.terrain, a.surface])
    if (s !== undefined) {
      if (
        s.frame !== "EPSG25832_GRID_NORTH" ||
        !["BILINEAR_SUPPORT_MAX_ENVELOPE", "PIXEL_FOOTPRINT_CONSTANT"].includes(
          s.reconstruction,
        ) ||
        s.geodesicCertification !== "NOT_CERTIFIED" ||
        !Array.isArray(s.sectors) ||
        s.sectors.length < 12 ||
        s.sectors.length > 720 ||
        !Array.isArray(s.errors) ||
        !s.errors.every((e) => typeof e === "string") ||
        !Number.isInteger(s.evaluatedCells) ||
        s.evaluatedCells < 0 ||
        typeof s.completeTraversal !== "boolean"
      )
        throw new Error("Invalid cell coverage");
      if (!s.conditions || !Object.values(s.conditions).every(Number.isFinite))
        throw new Error("Invalid interval conditions");
      for (let n = 0; n < s.sectors.length; n++) {
        const sector = s.sectors[n];
        if (
          sector.start !== (n * 360) / s.sectors.length ||
          sector.end !== ((n + 1) * 360) / s.sectors.length ||
          !["UNKNOWN", "CONDITIONAL_MODEL_BOUND"].includes(sector.status) ||
          !Number.isInteger(sector.cells) ||
          sector.cells < 0 ||
          !Number.isInteger(sector.missing) ||
          sector.missing < 0 ||
          sector.missing > sector.cells
        )
          throw new Error("Invalid sector coverage");
        for (const h of [sector.modelUpper, sector.knownCellUpper])
          if (h !== null && (!Number.isFinite(h) || h < -90 || h > 90))
            throw new Error("Invalid sector bound");
        if (
          sector.status === "UNKNOWN"
            ? sector.modelUpper !== null
            : !s.completeTraversal ||
              sector.missing > 0 ||
              sector.modelUpper === null ||
              sector.modelUpper !== sector.knownCellUpper
        )
          throw new Error("Unproven sector bound");
      }
    }
}
