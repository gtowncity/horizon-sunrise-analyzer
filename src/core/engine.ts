import type {
  Analysis,
  Inputs,
  Profile,
  Sample,
  ProgressFn,
  HorizonPoint,
} from "./types";
import type { ElevationProvider } from "../data/provider";
import {
  apparentAngle,
  curvatureDrop,
  destinationAlong,
  normalRadius,
  tileId,
  toUTM,
} from "./geo";
import {
  diskMargin,
  solarContact,
  standardSunrise,
  sun,
  localDay,
} from "./solar";
export function validateInputs(i: Inputs) {
  localDay(i.date, i.timezone);
  if (
    !Number.isFinite(i.observer.lat) ||
    !Number.isFinite(i.observer.lon) ||
    i.observer.lat < 47 ||
    i.observer.lat > 51 ||
    i.observer.lon < 8.5 ||
    i.observer.lon > 14.1
  )
    throw new Error("Standort außerhalb des bayerischen Suchgebiets");
  const ranges: [number, number, number, string][] = [
    [i.observerHeight, 0.05, 100, "Sichthöhe"],
    [i.distance, 10, 80000, "Entfernung"],
    [i.step, 0.2, 50, "Abtastschritt"],
    [i.azimuth, 0, 360, "Azimut"],
    [i.azimuthStep, 0.01, 1, "Azimutschritt"],
    [i.fanHalfWidth, 1, 15, "Fächer"],
    [i.atmosphere.k, 0, 0.5, "k"],
    [i.atmosphere.pressure, 300, 1100, "Luftdruck"],
    [i.atmosphere.temperature, -60, 60, "Temperatur"],
    [i.groundOffset, 0, 500, "Bodenerhöhung"],
    [i.positionUncertainty, 0, 1000, "Positionsunsicherheit"],
  ];
  for (const [v, lo, hi, name] of ranges)
    if (!Number.isFinite(v) || v < lo || v > hi)
      throw new Error(`${name}: zulässiger Bereich ${lo} bis ${hi}`);
  if (
    !["dgm1", "dom20"].includes(i.model) ||
    !["los", "sunrise"].includes(i.mode)
  )
    throw new Error("Unbekannter Analysemodus");
}
export function horizonMaximum(samples: Sample[], surface = false) {
  const candidates = samples.filter(
    (s) =>
      s.distance > 0 && Number.isFinite(surface ? s.surfaceAngle : s.angle),
  );
  if (!candidates.length) throw new Error("Kein gültiger Horizontpunkt");
  return candidates.reduce((a, b) =>
    (surface ? b.surfaceAngle! : b.angle) >
    (surface ? a.surfaceAngle! : a.angle)
      ? b
      : a,
  );
}
export async function profile(
  provider: ElevationProvider,
  i: Inputs,
  azimuth = i.azimuth,
  ground?: number,
): Promise<Profile> {
  const origin = toUTM(i.observer);
  const h0 = ground ?? (await provider.sampleMany([origin], "dgm1"))[0];
  const geometryStart = performance.now();
  const radius = normalRadius(i.observer.lat, azimuth),
    count = Math.ceil(i.distance / i.step);
  const locate = destinationAlong(i.observer, azimuth);
  const locations = Array.from({ length: count + 1 }, (_, j) =>
    locate(Math.min(j * i.step, i.distance)),
  );
  const xy = locations.map((p) => toUTM(p));
  if (provider.stats)
    provider.stats.geometryMs += performance.now() - geometryStart;
  const terrain = await provider.sampleMany(xy, "dgm1");
  let mathStart = performance.now();
  const eye = h0 + i.groundOffset + i.observerHeight;
  const samples: Sample[] = locations.map((p, j) => {
    const distance = Math.min(j * i.step, i.distance);
    return {
      ...p,
      distance,
      terrain: terrain[j],
      angle: distance
        ? apparentAngle(distance, terrain[j], eye, radius, i.atmosphere.k)
        : -90,
      drop: curvatureDrop(distance, radius, i.atmosphere.k),
      tile: tileId(...xy[j]),
    };
  });
  const initialBlocker = horizonMaximum(samples);
  // Preserve the full scan, then refine promising local maxima. This reduces
  // along-ray aliasing without pretending a coarse scan excludes unseen peaks.
  const candidates = samples
    .filter(
      (s, j) =>
        j > 0 &&
        j < samples.length - 1 &&
        s.angle >= samples[j - 1].angle &&
        s.angle >= samples[j + 1].angle &&
        s.angle > initialBlocker.angle - 0.05,
    )
    .sort((a, b) => b.angle - a.angle)
    .slice(0, 32);
  const existing = new Set(samples.map((s) => s.distance));
  const extraDistances = new Set<number>();
  for (const c of candidates)
    for (let offset = -3; offset <= 3; offset++) {
      const d = c.distance + (offset * i.step) / 4;
      if (d > 0 && d < i.distance && !existing.has(d)) extraDistances.add(d);
    }
  const distances = [...extraDistances].sort((a, b) => a - b);
  const extra = distances.map(locate);
  if (provider.stats)
    provider.stats.profileMathMs += performance.now() - mathStart;
  if (extra.length) {
    const heights = await provider.sampleMany(
      extra.map((p) => toUTM(p)),
      "dgm1",
    );
    mathStart = performance.now();
    extra.forEach((p, j) =>
      samples.push({
        ...p,
        distance: distances[j],
        terrain: heights[j],
        angle: apparentAngle(
          distances[j],
          heights[j],
          eye,
          radius,
          i.atmosphere.k,
        ),
        drop: curvatureDrop(distances[j], radius, i.atmosphere.k),
        tile: tileId(...toUTM(p)),
      }),
    );
    samples.sort((a, b) => a.distance - b.distance);
    if (provider.stats)
      provider.stats.profileMathMs += performance.now() - mathStart;
  }
  const blocker = horizonMaximum(samples);
  let surfaceBlocker: Sample | undefined;
  if (i.model === "dom20") {
    const indices = samples
      .map((s, j) => ({ s, j }))
      .filter(
        ({ s }) =>
          i.domMode === "full" ||
          s.distance < 500 ||
          s.angle > blocker.angle - 0.15,
      )
      .map(({ j }) => j);
    const surface = await provider.sampleMany(
      indices.map((j) => toUTM(samples[j])),
      "dom20",
    );
    mathStart = performance.now();
    for (let n = 0; n < indices.length; n++) {
      const s = samples[indices[n]];
      s.surface = surface[n];
      s.excess = s.surface - s.terrain;
      s.surfaceAngle = s.distance
        ? apparentAngle(s.distance, s.surface, eye, radius, i.atmosphere.k)
        : -90;
    }
    surfaceBlocker = horizonMaximum(samples, true);
    if (provider.stats)
      provider.stats.profileMathMs += performance.now() - mathStart;
  }
  const target = samples.at(-1)!;
  const before = samples.slice(1, -1);
  const targetAngle =
    i.model === "dom20" && target.surfaceAngle !== undefined
      ? target.surfaceAngle
      : target.angle;
  const targetVisible = !before.some(
    (s) =>
      (i.model === "dom20" ? (s.surfaceAngle ?? s.angle) : s.angle) >
      targetAngle + 1e-9,
  );
  return {
    azimuth,
    ground: h0,
    samples,
    blocker,
    surfaceBlocker,
    surfaceComplete: i.model === "dom20" && i.domMode === "full",
    targetVisible,
    radius,
  };
}
/** Bounded waves coalesce file/block reads without retaining the whole fan's
 * full sample objects. Array order, rays and all profile maths stay unchanged. */
async function horizonProfiles(
  provider: ElevationProvider,
  i: Inputs,
  azimuths: number[],
  ground: number,
  progress: ProgressFn,
  stage: string,
) {
  const out: HorizonPoint[] = [];
  const wave = provider.batch
    ? Math.max(
        1,
        Math.min(
          24,
          // Raster requests are sectioned by the provider. Allow more adjacent
          // rays to share blocks while retaining a bounded total sample count.
          Math.floor(480000 / (Math.ceil(i.distance / i.step) + 194)),
        ),
      )
    : 1;
  for (let start = 0; start < azimuths.length; start += wave) {
    progress({
      stage,
      fraction: start / azimuths.length,
      detail: `Sichtlinien ${start + 1}–${Math.min(start + wave, azimuths.length)} / ${azimuths.length}`,
    });
    const work = () =>
      Promise.all(
        azimuths.slice(start, start + wave).map(async (azimuth) => {
          const pr = await profile(provider, i, azimuth, ground);
          const b =
            i.model === "dom20"
              ? (pr.surfaceBlocker ?? pr.blocker)
              : pr.blocker;
          return {
            azimuth,
            angle: i.model === "dom20" ? (b.surfaceAngle ?? b.angle) : b.angle,
            blocker: b,
          };
        }),
      );
    out.push(...(await (provider.batch ? provider.batch(work) : work())));
  }
  return out;
}
export async function analyze(
  provider: ElevationProvider,
  i: Inputs,
  progress: ProgressFn,
  commit = "development",
): Promise<Analysis> {
  validateInputs(i);
  const start = performance.now(),
    warnings = [
      "Ergebnis gilt für den berechneten Entfernungsbereich. Weiter entfernte Hindernisse sind nicht ausgeschlossen.",
      `Räumliche Abtastung ${i.step} m. Ein endliches Raster ist kein Nachweis aller schmalen Hindernisse.`,
      "NHN-Höhen im lokalen GRS80-Normalschnittmodell; Geoidneigung und Lotabweichung sind nicht modelliert.",
    ];
  if (i.groundOffset)
    warnings.push(
      `Künstliche Bodenerhöhung ${i.groundOffset} m: ausschließlich Sensitivitätsanalyse.`,
    );
  if (i.positionUncertainty)
    warnings.push(
      `Positionsunsicherheit ${i.positionUncertainty} m: nicht in ein statistisches Zeitintervall umgerechnet.`,
    );
  if (i.model === "dom20" && i.domMode === "critical")
    warnings.push(
      "DOM20 nur in Kandidatenregionen: unvollständiger Oberflächenhorizont; keine gesicherte First-Visible-Zeit.",
    );
  let p: Profile;
  const horizon: HorizonPoint[] = [];
  const timedSolar = <T>(work: () => T): T => {
    const began = performance.now();
    try {
      return work();
    } finally {
      if (provider.stats) provider.stats.solarMs += performance.now() - began;
    }
  };
  const contactSearch = (...args: Parameters<typeof solarContact>) =>
    timedSolar(() => solarContact(...args));
  const standard = timedSolar(() =>
    standardSunrise(i.date, i.timezone, i.observer),
  );
  let contact: Analysis["contact"];
  const sensitivity: NonNullable<Analysis["sensitivity"]> = [];
  if (i.mode === "los") {
    progress({
      stage: "Profil",
      fraction: 0,
      detail: "Vollständige Sichtlinie abtasten",
    });
    p = await profile(provider, i);
  } else {
    if (!standard)
      throw new Error("An diesem Datum kein Standard-Sonnenaufgang");
    const center = sun(new Date(standard), i.observer, i.atmosphere).azimuth;
    const min = center - i.fanHalfWidth,
      max = center + i.fanHalfWidth;
    const n = Math.ceil((max - min) / i.azimuthStep);
    const ground = (await provider.sampleMany([toUTM(i.observer)], "dgm1"))[0];
    const azimuths = Array.from(
      { length: n + 1 },
      (_, j) => min + ((max - min) * j) / n,
    );
    horizon.push(
      ...(await horizonProfiles(
        provider,
        i,
        azimuths,
        ground,
        progress,
        "Horizonte berechnen",
      )),
    );
    // Search only when the complete disk stays inside the calculated fan.
    let windowStart = Date.parse(standard) - 1800000,
      windowEnd = Date.parse(standard) + 7200000;
    while (
      sun(new Date(windowStart), i.observer, i.atmosphere).azimuth <
      min + 0.4
    )
      windowStart += 1000;
    while (
      sun(new Date(windowEnd), i.observer, i.atmosphere).azimuth >
      max - 0.4
    )
      windowEnd -= 1000;
    progress({
      stage: "Sonnenkontakt",
      fraction: 0,
      detail: "Gesamte Sonnenscheibe gegen H(A) prüfen",
    });
    if (windowEnd <= windowStart)
      throw new Error("Azimutfächer zu klein für Kontaktfenster");
    contact = contactSearch(
      i.observer,
      i.atmosphere,
      horizon,
      windowStart,
      windowEnd,
    );
    if (contact && i.azimuthStep > 0.02) {
      const coarseContact = contact;
      const refineStart = Math.max(min, contact.limbAzimuth - 0.5);
      const refineEnd = Math.min(max, contact.limbAzimuth + 0.5);
      const refineStep = Math.max(0.01, Math.min(0.02, i.azimuthStep / 4));
      const count = Math.ceil((refineEnd - refineStart) / refineStep);
      const fineAzimuths: number[] = [];
      for (let j = 0; j <= count; j++) {
        const az = refineStart + ((refineEnd - refineStart) * j) / count;
        if (horizon.some((h) => Math.abs(h.azimuth - az) < 1e-8)) continue;
        fineAzimuths.push(az);
      }
      horizon.push(
        ...(await horizonProfiles(
          provider,
          i,
          fineAzimuths,
          ground,
          progress,
          "Kontaktregion verfeinern",
        )),
      );
      horizon.sort((a, b) => a.azimuth - b.azimuth);
      contact = contactSearch(
        i.observer,
        i.atmosphere,
        horizon,
        windowStart,
        windowEnd,
      );
      if (contact)
        sensitivity.push({
          parameter: "angularRefinementSeconds",
          value: refineStep,
          time: contact.time,
          deltaSeconds:
            (Date.parse(contact.time) - Date.parse(coarseContact.time)) / 1000,
        });
      warnings.push(
        `Kontaktregion adaptiv bis ${refineStep}° verfeinert. Außerhalb verbleibt das eingestellte Azimutgitter; keine globale Fehlergarantie.`,
      );
    }
    if (!contact)
      warnings.push(
        "Kein Kontakt im berechneten Azimutfächer. Fächer vergrößern.",
      );
    if (contact && (i.model === "dgm1" || i.domMode === "full")) {
      for (const shift of [-0.1, 0.1]) {
        const shifted = horizon.map((h) => ({ ...h, angle: h.angle + shift }));
        try {
          const c = contactSearch(
            i.observer,
            i.atmosphere,
            shifted,
            windowStart,
            windowEnd,
          );
          sensitivity.push({
            parameter: "horizonOffsetDegrees",
            value: shift,
            time: c?.time,
            deltaSeconds: c
              ? (Date.parse(c.time) - Date.parse(contact.time)) / 1000
              : undefined,
          });
        } catch {
          /* interval does not bracket this sensitivity */
        }
      }
      const half = diskMargin(
        sun(new Date(contact.time), i.observer, i.atmosphere),
        horizon,
        i.atmosphere,
        1440,
      );
      if (Math.abs(half.margin - contact.margin) > 0.001)
        warnings.push(
          "Limb-Abtastung noch nicht konvergiert: Winkelabweichung >0,001° bei Verdopplung.",
        );
    }
    p = await profile(provider, i, contact?.limbAzimuth ?? center, ground);
    warnings.push(
      `H(A) linear zwischen ${i.azimuthStep}°-Strahlen. Die Zeitauflösung des Solvers ist keine physikalische Genauigkeit. Atmosphärische Unsicherheit kann wesentlich größer sein.`,
    );
  }
  progress({ stage: "Fertig", fraction: 1, detail: "Analyse abgeschlossen" });
  return {
    schema: "hsa-1",
    version: "0.9.1",
    commit,
    timestamp: new Date().toISOString(),
    inputs: structuredClone(i),
    profile: p,
    horizon,
    standardSunrise: standard,
    contact,
    tiles: [...provider.records.values()],
    warnings,
    elapsedMs: performance.now() - start,
    performance: provider.stats
      ? { ...provider.stats, totalMs: performance.now() - start }
      : undefined,
    sensitivity,
  };
}
