# Reproducibility

Commit and lockfile identify software. JSON exports include schema hsa-1, version, commit, UTC timestamp, exact inputs, full contact sightline, horizon samples, source URLs/tile IDs, byte counts, download state/timestamp and SHA-256 where available. CSV uses explicit units in headers. Chart PNG is a visualization, not sufficient to reconstruct an analysis.

Binary source samples are float32 as stored; transformations, interpolation, angles and solver calculations are binary64 JavaScript Numbers. UTC timestamps cross the worker boundary; Intl with an IANA zone determines civil-day boundaries and display. DST days may be 23 or 25 hours.

The local audit is intentionally gitignored and never uploaded. It contains exact private locations, raw source data, intermediate profiles, download manifests, dependency versions, test reports, final commit and a checksummed snapshot. Public scientific summaries omit site-identifying values.

For a repeat analysis, retain the original TIFF bytes as well as exported JSON. A current server response may reflect a later survey or processing release. An imported JSON is a report, not a fresh verification of its data authenticity.

Performance exports distinguish ZIP payload bytes, extracted TIFF sizes and decoded buffers. MB means 1,000,000 bytes; MiB means 1,048,576 bytes. Concurrent stage durations overlap and must not be added as total runtime. Monotonic totalMs/elapsedMs measures wall time. Private Node experiments measure process RSS; this is not browser heap usage. ZIP counts exclude HTTP/TLS overhead and service control responses. Per-file transferMs and serviceMs separate transfer from ZIP preparation.

Exact-result reuse is labelled resultCacheHit and preserves original calculation time separately. It is not a fresh full computation. Original-file warm runs use a new provider without derived results. Empty application storage does not establish empty HTTP/OS/server caches. Private PERFORMANCE_OPTIMIZATION reports retain failed attempts, parameter assumptions, SHA-256 source manifests and raw measurements; public summaries omit identifying coordinates and tile IDs.
