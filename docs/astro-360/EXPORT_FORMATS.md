# Export formats and safety

Current scientific JSON schema astro360-3: nominal sampled maxima/reference, source hashes, inputs, ray errors/gaps, projected cell bounds/missing supports, propagated eye/position intervals, measurement status, algorithm hash and actual counters. Legacy v1/v2 are historical inspection formats. Upper model numbers cannot replace unknown values or be presented as measured truth.

CSV retains nominal ray values with units/status; empty nulls are UNKNOWN. Full conditional cell evidence is in JSON. SVG/PNG are plotted snapshots, not scientific support-point substitution. Graphics do not interpolate the unexamined 240° arc.

exportNina ALWAYS throws for supported v1/v2/v3 results, for both physical/planning and regardless of acknowledgement. There is no dormant positive branch or artificial numeric closing point. User interface buttons are disabled and explain missing certification. Strict schema/seam/radial checks report why; a regular sampled lattice still fails spatial proof. Future export must be reviewed separately, including conservative interpolation and actual consumer import. Scientific release BLOCKED. NINA export DENIED for all supported schemas. Full geographic/physical coverage NOT_CERTIFIED; no on-site measurements. Current partial model and acceptance gates: ADR-0002-fail-closed-native-cells.md and ROUND2_STATUS.json.
