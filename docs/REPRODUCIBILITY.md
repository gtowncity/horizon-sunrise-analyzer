# Reproducibility

Commit and lockfile identify software. JSON exports include schema hsa-1, version, commit, UTC timestamp, exact inputs, full contact sightline, horizon samples, source URLs/tile IDs, byte counts, download state/timestamp and SHA-256 where available. CSV uses explicit units in headers. Chart PNG is a visualization, not sufficient to reconstruct an analysis.

Binary source samples are float32 as stored; transformations, interpolation, angles and solver calculations are binary64 JavaScript Numbers. UTC timestamps cross the worker boundary; Intl with an IANA zone determines civil-day boundaries and display. DST days may be 23 or 25 hours.

The local audit is intentionally gitignored and never uploaded. It contains exact private locations, raw source data, intermediate profiles, download manifests, dependency versions, test reports, final commit and a checksummed snapshot. Public scientific summaries omit site-identifying values.

For a repeat analysis, retain the original TIFF bytes as well as exported JSON. A current server response may reflect a later survey or processing release. An imported JSON is a report, not a fresh verification of its data authenticity.
