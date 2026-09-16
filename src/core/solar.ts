import { Body, Equator, Horizon, Observer } from "astronomy-engine";
import type {
  Atmosphere,
  Contact,
  HorizonPoint,
  Position,
  SolarPosition,
} from "./types";
import { normalizeAzimuth, RAD } from "./geo";
/** NOAA's piecewise correction; outside the near-horizon validity range we refuse a contact. */
export function solarRefraction(h: number, pressure = 1010, temperature = 10) {
  if (pressure <= 0 || temperature <= -273.15)
    throw new Error("Ungültige Atmosphäre");
  if (h > 85) return 0;
  const t = Math.tan(h * RAD);
  const arcseconds =
    h > 5
      ? 58.1 / t - 0.07 / t ** 3 + 0.000086 / t ** 5
      : h > -0.575
        ? 1735 - 518.2 * h + 103.4 * h * h - 12.79 * h ** 3 + 0.711 * h ** 4
        : -20.774 / t;
  return (arcseconds / 3600) * (pressure / 1010) * (283 / (273 + temperature));
}
export function sun(
  date: Date,
  p: Position,
  atmosphere: Atmosphere,
): SolarPosition {
  // Observer ellipsoid height is intentionally fixed to zero: do not pass NHN as ellipsoid height.
  // The resulting solar parallax difference for <=3 km elevation is <0.005 arcsecond.
  const observer = new Observer(p.lat, p.lon, 0);
  const equ = Equator(Body.Sun, date, observer, true, true);
  const hor = Horizon(date, observer, equ.ra, equ.dec);
  const radius = Math.asin(695700 / (equ.dist * 149597870.7)) / RAD;
  return {
    azimuth: hor.azimuth,
    altitude: hor.altitude,
    apparentAltitude:
      hor.altitude +
      (atmosphere.solarRefraction
        ? solarRefraction(
            hor.altitude,
            atmosphere.pressure,
            atmosphere.temperature,
          )
        : 0),
    radius,
    distanceAU: equ.dist,
    declination: equ.dec,
  };
}
export function localDay(
  date: string,
  timezone: string,
): { start: number; end: number } {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    date < "1901-01-01" ||
    date > "2099-12-31"
  )
    throw new Error("Datum außerhalb 1901–2099");
  const dateMs = Date.parse(date + "T00:00:00Z");
  if (new Date(dateMs).toISOString().slice(0, 10) !== date)
    throw new Error("Ungültiges Datum");
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const midnight = (utc: number) => {
    let guess = utc;
    for (let i = 0; i < 4; i++) {
      const parts = Object.fromEntries(
        fmt.formatToParts(guess).map((p) => [p.type, p.value]),
      );
      const represented = Date.UTC(
        +parts.year,
        +parts.month - 1,
        +parts.day,
        +parts.hour,
        +parts.minute,
        +parts.second,
      );
      guess += utc - represented;
    }
    return guess;
  };
  return { start: midnight(dateMs), end: midnight(dateMs + 86400000) };
}
export function bisectFirst(
  fn: (t: number) => number,
  start: number,
  end: number,
  scanMs = 1000,
  toleranceMs = 50,
) {
  let previous = fn(start);
  if (previous >= 0) throw new Error("Kontaktfenster beginnt bereits sichtbar");
  for (
    let t = Math.min(start + scanMs, end);
    t <= end;
    t = Math.min(end, t + scanMs)
  ) {
    const value = fn(t);
    if (previous < 0 && value >= 0) {
      let lo = Math.max(start, t - scanMs),
        hi = t,
        iterations = 0;
      while (hi - lo > toleranceMs) {
        const mid = (lo + hi) / 2;
        if (fn(mid) >= 0) hi = mid;
        else lo = mid;
        iterations++;
      }
      return { time: hi, iterations, bracketMs: hi - lo };
    }
    if (t === end) break;
    previous = value;
  }
  return null;
}
export function standardSunrise(date: string, timezone: string, p: Position) {
  const { start, end } = localDay(date, timezone);
  const off = { k: 0, solarRefraction: false, pressure: 1010, temperature: 10 };
  const result = bisectFirst(
    (t) => sun(new Date(t), p, off).altitude + 0.8333,
    start,
    end,
    60000,
    50,
  );
  return result ? new Date(result.time).toISOString() : undefined;
}
export function horizonAt(points: HorizonPoint[], azimuth: number) {
  if (points.length < 2)
    throw new Error("Horizont benötigt mindestens zwei Azimute");
  let a = azimuth;
  while (a < points[0].azimuth - 180) a += 360;
  while (a > points.at(-1)!.azimuth + 180) a -= 360;
  if (a < points[0].azimuth - 1e-8 || a > points.at(-1)!.azimuth + 1e-8)
    throw new Error("Sonnenscheibe außerhalb des berechneten Azimutfächers");
  let lo = 0,
    hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].azimuth <= a) lo = mid;
    else hi = mid;
  }
  const f =
    (a - points[lo].azimuth) / (points[hi].azimuth - points[lo].azimuth);
  return points[lo].angle + (points[hi].angle - points[lo].angle) * f;
}
/** Exact spherical small-circle limb. Each limb ray is refracted at its own altitude.
 * Includes horizon knots to resolve narrow notches in the piecewise linear H(A). */
export function diskMargin(
  s: SolarPosition,
  horizon: HorizonPoint[],
  atmosphere: Atmosphere,
  segments = 720,
) {
  const a = s.azimuth * RAD,
    h = s.altitude * RAD,
    r = s.radius * RAD;
  let best = { margin: -Infinity, azimuth: s.azimuth, altitude: s.altitude };
  const evaluate = (A: number, H: number) => {
    const alt =
      H +
      (atmosphere.solarRefraction
        ? solarRefraction(H, atmosphere.pressure, atmosphere.temperature)
        : 0);
    const margin = alt - horizonAt(horizon, A);
    if (margin > best.margin)
      best = { margin, azimuth: normalizeAzimuth(A), altitude: alt };
  };
  for (let i = 0; i < segments; i++) {
    const t = (2 * Math.PI * i) / segments;
    const H = Math.asin(
      Math.sin(h) * Math.cos(r) + Math.cos(h) * Math.sin(r) * Math.cos(t),
    );
    const A =
      a +
      Math.atan2(
        Math.sin(t) * Math.sin(r) * Math.cos(h),
        Math.cos(r) - Math.sin(h) * Math.sin(H),
      );
    evaluate(A / RAD, H / RAD);
  }
  for (const knot of horizon) {
    const da = (knot.azimuth - s.azimuth) * RAD;
    const C = Math.cos(h) * Math.cos(da),
      S = Math.sin(h),
      L = Math.hypot(C, S);
    if (Math.cos(r) <= L) {
      const H = Math.atan2(S, C) + Math.acos(Math.min(1, Math.cos(r) / L));
      if (Math.abs(da) < (2 * r) / Math.max(0.1, Math.cos(h)))
        evaluate(knot.azimuth, H / RAD);
    }
  }
  return best;
}
export function solarContact(
  p: Position,
  atmosphere: Atmosphere,
  horizon: HorizonPoint[],
  start: number,
  end: number,
): Contact | undefined {
  const fn = (t: number) =>
    diskMargin(sun(new Date(t), p, atmosphere), horizon, atmosphere).margin;
  const root = bisectFirst(fn, start, end, 1000, 50);
  if (!root) return undefined;
  const s = sun(new Date(root.time), p, atmosphere),
    disk = diskMargin(s, horizon, atmosphere);
  return {
    time: new Date(root.time).toISOString(),
    azimuth: s.azimuth,
    altitude: s.altitude,
    limbAzimuth: disk.azimuth,
    limbAltitude: disk.altitude,
    margin: disk.margin,
    iterations: root.iterations,
    bracketMs: root.bracketMs,
  };
}
