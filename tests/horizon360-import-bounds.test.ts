import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import {
  importHorizonJSON,
  exportNina,
} from "../src/features/horizon360/export";
function publicEvidence() {
  return JSON.parse(
    readFileSync(
      "docs/astro-360/evidence/round2/browser-multisite.json",
      "utf8",
    ),
  ).sites[0].result;
}
test("v3 public interval evidence round-trips while NINA remains denied", () => {
  const r = publicEvidence();
  expect(importHorizonJSON(JSON.stringify(r))).toEqual(r);
  for (const planning of [false, true])
    expect(() => exportNina(r, planning, true)).toThrow(
      "UNCERTIFIED_SPATIAL_COVERAGE",
    );
});
test.each([
  "missing-condition",
  "reversed-eye",
  "fake-certification",
  "unknown-numeric-bound",
  "old-reconstruction",
])("reject forged/unsupported spatial evidence %s", (kind) => {
  const r = publicEvidence(),
    audit = r.spatialAudit.terrain;
  if (kind === "missing-condition") delete audit.conditions.eyeMin;
  if (kind === "reversed-eye")
    audit.conditions.eyeMin = audit.conditions.eyeMax + 1;
  if (kind === "fake-certification") audit.geodesicCertification = "CERTIFIED";
  if (kind === "unknown-numeric-bound") audit.sectors[0].status = "UNKNOWN";
  if (kind === "old-reconstruction")
    audit.reconstruction = "PIXEL_FOOTPRINT_CONSTANT";
  expect(() => importHorizonJSON(JSON.stringify(r))).toThrow();
  expect(() => exportNina(r, false, true)).toThrow();
});
