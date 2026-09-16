# Scientific changelog

## 0.8.1 — 2026-09-16

Fixed false diagonal DOM/surface-excess lines when zooming or panning profiles containing missing surface data. ECharts LTTB downsampling can return nonmonotonic raw indices after zoom filtering across null runs. Gapped series now render without downsampling and keep every measured peak and missing-data boundary; continuous series retain their existing rendering optimization. Numerical analysis and exported values are unchanged. A regression test checks the processed chart point order, gaps and retained values through repeated zoom, pan and desktop/mobile resize.

## 0.8.0 — 2026-09-16

Added official ZIP transport with persistent cache; validated EPSG:25832 PixelIsArea sampling; GRS80 local normal-section terrain angles; separate terrestrial and astronomical refraction; dynamic solar radius and spherical disk-limb contact; full and partial DOM modes; adaptive spatial maxima and contact-region refinement; scientific exports; unit, browser and real-data checks.

Validation exposed and corrected half-cell handling requirements, MapLibre module-worker packaging, ZIP status responses with null URLs and transient partial status JSON. Direct raster transfers also failed intermittently during local experiments, supporting the official ZIP transport choice.

Independent NOAA and USNO comparisons support the ephemeris model in tested cases. Scientific 1.0 is intentionally not declared until the unresolved error-bound and physical validation gates documented in LIMITATIONS are closed.
