# Input schema (current astro360-3)

Keep all original ray limits: Bayern search envelope 47..51 N,8.5..14.1 E (not administrative membership proof), relative optical height .05..100 m, optional absolute DHHN2016 -100..4000 m, terrain radius10..80000 m, surface0..min(terrain,2000), k0..0.5, user minimum -90..90°, specified margin0..30°. Position0..1000 m and vertical0..100 m.

New optional nonnegative fields: opticalHorizontalMotion, opticalHeightBelow, opticalHeightAbove, terrainHeightError, surfaceHeightError (each <=100 m). Zero defaults are explicitly scenario assumptions. maxCells integer1000..2000000 (default200000). Original maxRays12..720, maxSamples1000..2000000, maxTiles1..100, maxArchiveBytes1..1024 MiB. Every supplied optional field is runtime-validated.

astro360-3 adds scientific value semantics, separate projected spatialAudit and algorithm hash. v1 and intermediate v2 are read for historical inspection; no migration changes original numerical values. All versions are NINA-ineligible. Imported assertions do not become physical certification. Invalid version/values/sorting/seam/model-bound state are rejected. Scientific release BLOCKED. NINA export DENIED for all supported schemas. Full geographic/physical coverage NOT_CERTIFIED; no on-site measurements. Current partial model and acceptance gates: ADR-0002-fail-closed-native-cells.md and ROUND2_STATUS.json.
