# Architecture

Original core/data/solar/worker mathematics unchanged. src/features/horizon360 isolates engine, types, UI/Charts/Map, plot-data, export, raster-sectors, cell-source, uncertainty and bounded-download. Worker emits nominal rays plus DETAIL spatialAudit/cellMetrics. New feature algorithm SHA256 covers feature code, selected shared numeric/raster code and lockfile; original algorithm hash remains unchanged by this addition.

readBoundedArchive checks Content-Length where supplied, consumes chunks under remaining budget, cancels on overflow and charges received chunks even if the request fails. Whole successful archive/GeoTIFF materialization still requires finite transient memory; cached-source/block metrics are not full heap. Official start/poll retries are bounded and reported, without placeholder data. Existing original loader remains unchanged for regression safety.

NativeCellSource processes intersecting native blocks without naive full disk materialization. Its caches reuse original source blobs; per-cell iterator streams data, and budget truncation yields no full-sector certificate. Map uses ResizeObserver and resets cleanup callback; separate DOM radius and service failure status are visible. Both views break uninvestigated angular gaps; SVG/PNG are visualization snapshots.

ADRs 0001/0002 document changed decisions and historical prototypes. Scientific release BLOCKED. NINA export DENIED for all supported schemas. Full geographic/physical coverage NOT_CERTIFIED; no on-site measurements. Current partial model and acceptance gates: ADR-0002-fail-closed-native-cells.md and ROUND2_STATUS.json.
