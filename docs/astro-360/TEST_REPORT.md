# Test report

P0 Node v24.19.0 Windows: npm ci PASS; lint PASS; typecheck PASS; npm test 98/98 PASS; build PASS; Chromium install PASS; E2E 4/4 PASS; npm audit FAIL with 1 high source-map-js advisory. Logs/durations/exitcodes in baseline/report.json. Corrected lockfile source-map-js 1.2.2, no API/code patch in original scientific engine.

First feature E2E: 6 PASS, 2 FAIL due missing accessible name for azimuth number input. Corrected explicit aria labels on range and numeric inputs; assertions unchanged. Rerun: 8 PASS, 0 FAIL. Current full check 2026-10-12T10:25:40Z: lint, TS, unit (137 PASS), build, Chromium, E2E (8 PASS), audit (0 vulnerabilities) all exit 0. Final post-review rerun appears in the package evidence/report.json. No faked successful network/physical checks.

ZIP readback uses independent Node zlib decompression, central/local header validation, per-file CRC32, size/SHA256 against manifest, exact entry count and JSON/CSV/Markdown readback. Deliberate corruption tests cover CRC, SHA and missing manifest entries.

Independent numerical crosscheck: 48 selected real-data blocker angles, maximum absolute discrepancy 4.903659700516982e-9° versus Cartesian spherical expression. Tolerance 1e-6° allows Earth-radius subtraction cancellation at near range. This checks numerical formulas only; no physical accuracy or continuous peak proof. Script and individual expected/computed values in evidence/independent-reference.json.

Real browser DGM1/DOM20 CORS probe completed at public Olympiapark: 9.765 s, Chromium 153.0.8010.12, 2 original source files, no page errors. This is one browser site, all sectors INCOMPLETE. Corresponding SHA256 file hashes match exactly; sampled angles differ by at most 5.20604004350389e-10°, not byte-identical across runtimes. See evidence/browser-real.json.
