/** Independent numeric crosscheck using Cartesian spherical coordinates only. */
import { readFileSync, writeFileSync } from "node:fs";
const input = process.argv[2] ?? "docs/astro-360/evidence/real-data.json";
const output =
  process.argv[3] ?? "docs/astro-360/evidence/independent-reference.json";
const source = JSON.parse(readFileSync(input));
const checks = [];
for (const site of source.sites) {
  if (!site.directions) continue;
  for (const direction of site.directions)
    for (const model of ["terrain", "surface"]) {
      const b = direction[model].blocker;
      if (!b) continue;
      const p = Math.PI / 180,
        lat = site.site.observer.lat * p,
        az = direction.azimuth * p;
      const f = 1 / 298.257222101,
        a = 6378137,
        e2 = f * (2 - f),
        q = 1 - e2 * Math.sin(lat) ** 2;
      const n = a / Math.sqrt(q),
        m = (a * (1 - e2)) / q ** 1.5;
      const radius =
        1 / (Math.cos(az) ** 2 / m + Math.sin(az) ** 2 / n) / (1 - 0.13);
      const theta = b.distance / radius;
      const vertical =
        (radius + b.height) * Math.cos(theta) - (radius + site.eye);
      const horizontal = (radius + b.height) * Math.sin(theta);
      const expected = Math.atan2(vertical, horizontal) / p,
        error = Math.abs(expected - b.angle);
      checks.push({
        site: site.site.name,
        azimuthDeg: direction.azimuth,
        model,
        distanceM: b.distance,
        expectedDeg: expected,
        computedDeg: b.angle,
        absoluteErrorDeg: error,
      });
    }
}
const maxAbsoluteErrorDeg = Math.max(...checks.map((c) => c.absoluteErrorDeg));
// Independent expression subtracts ~Earth radius; near-range floating cancellation.
const toleranceDeg = 1e-6;
const report = {
  classification:
    checks.length > 0 && maxAbsoluteErrorDeg < toleranceDeg ? "PASS" : "FAIL",
  checks,
  toleranceDeg,
  maxAbsoluteErrorDeg,
  scope:
    "Numerical formula crosscheck at selected public-data sampled blockers, not independent peak coverage, interpolation or physical ground truth",
};
writeFileSync(output, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    classification: report.classification,
    checks: checks.length,
    maxAbsoluteErrorDeg,
    toleranceDeg,
  }),
);
if (report.classification !== "PASS") process.exitCode = 1;
