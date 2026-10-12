# FAST and DETAIL

FAST: nominal bounded adaptive rays (10° initial, 1° minimum, 10 m terrain step, DOM min(step,2 m), 144 rays/100000 samples default). DETAIL: finer adaptive rays (5°,0.5°,1 m, DOM min(step,0.5 m), 360/500000) PLUS native bilinear support audit and deterministic intervals. Native cell budget defaults 200000, independently editable. Large default kilometre disks may exceed this budget; UNKNOWN model bounds are then explicit.

At identical ray settings the ray results remain equal, while worker DETAIL adds a separate raster model. It does not upgrade geographic or physical coverage. Preflight counts are conservative tile bounds; bytes/duration remain unknown until measured. New feature ZIP downloads stream with a remaining-byte cap and cancellation; consumed unsuccessful chunks are charged. One already-received chunk may exceed the cap before cancellation; retained payload is limited. Cache/block metrics do not include full browser/worker heap.

Cold/warm/stress public-site results and exact scopes are in PERFORMANCE_REAL_DATA.md; no statewide speed extrapolation. Scientific release BLOCKED. NINA export DENIED for all supported schemas. Full geographic/physical coverage NOT_CERTIFIED; no on-site measurements. Current partial model and acceptance gates: ADR-0002-fail-closed-native-cells.md and ROUND2_STATUS.json.
