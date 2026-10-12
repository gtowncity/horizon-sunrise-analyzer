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
/** Explicitly provisional: never silently interpolate UNKNOWN corridors. */
export function exportNina(
  r: HorizonResult,
  planning = false,
  acceptIncomplete = false,
) {
  if (!acceptIncomplete)
    throw new Error("VORLÄUFIG-Export muss ausdrücklich bestätigt werden");
  if (
    r.directions.length < 2 ||
    r.directions[0].azimuth !== 0 ||
    r.directions.some(
      (d) =>
        d.actual === null ||
        d.terrain.status === "UNKNOWN" ||
        (r.inputs.surfaceDistance > 0 && d.surface.status === "UNKNOWN"),
    )
  )
    throw new Error("UNKNOWN-Korridor: N.I.N.A.-Export gesperrt");
  const points = r.directions.map((d) => [
    d.azimuth,
    planning ? d.planning : d.actual,
  ]);
  points.push([360, points[0][1]]);
  return (
    "# VORLAEUFIG INCOMPLETE - no guaranteed clear sky or full camera FOV\r\n# Az Alt\r\n" +
    points.map(([a, h]) => `${a!.toFixed(8)} ${h!.toFixed(8)}`).join("\r\n") +
    "\r\n"
  );
}
export function importHorizonJSON(text: string): HorizonResult {
  if (text.length > 32 * 1024 * 1024)
    throw new Error("Import größer als 32 MiB");
  const raw = JSON.parse(text);
  if (raw?.schema !== "astro360-1" || raw.method !== "adaptive-rays-v1")
    throw new Error(
      "Nicht unterstützte Schema-/Modellversion; keine implizite Migration",
    );
  validateHorizonInputs(raw.inputs);
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
  return raw as HorizonResult;
}
