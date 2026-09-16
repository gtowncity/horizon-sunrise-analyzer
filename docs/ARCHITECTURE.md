# Architecture

React owns inputs, status, map and charts. A dedicated module worker owns downloads, ZIP extraction, GeoTIFF decoding, profile sampling and contact search. Terminating it implements cancellation. IndexedDB survives worker replacement. MapLibre has a separately bundled module worker.

Modules: src/core/geo.ts (projection/geodesics/curvature), raster.ts (interpolation), solar.ts (ephemerides/disk/root search), engine.ts (orchestration), export.ts (schema and CSV). src/data/provider.ts implements ElevationProvider independently of the UI; cache.ts supplies browser and in-memory stores. Tests use injected synthetic providers without changing production behavior.

Provider records track each used model/tile and distinguish Downloaded, Cached, Local, Loading and Failed. Failed data never become zero elevations. The UI discards the result on changed inputs. Exports preserve the inputs used in the actual calculation. See ADRs for alternatives.

## Native-block processing (0.9.0)

The production worker uses BatchedProvider; the whole-raster provider remains for reference comparisons. Independent rays run in bounded waves (at most 24 rays and approximately 160,000 base points per wave). Existing DGM sampling, spatial refinement and complete/partial DOM requests coalesce at await boundaries. Four interpolation pixels are routed to validated native files and blocks, then scattered back in original point order into Float32 slots; the existing binary64 bilinear interpolation is unchanged. Zero-weight neighbours are still requested exactly as before.

TIFF tile/strip dimensions come from each image's metadata. Partial edge blocks use their actual decoded row width. Native readRasters windows specify no resampling/output size. Two file pipelines, each reading one block at a time, bound concurrency; no decoder-worker pool is created. Whole-image strips still require whole-image decoding and are counted accordingly.

Caches are distinct: original compressed TIFF bytes in existing IndexedDB v1; 192 MiB of open source files per analysis; 96 MiB of decoded blocks per analysis; and at most three exact-input results. Block keys include the source fingerprint. Result keys include all inputs, algorithm namespace and build commit; every source fingerprint and local/source provenance is checked before reuse. Reading sources for this check has a cost. There is no persistent prepared-profile cache. Waves release full profiles after extracting horizon values. Coordinates and angles are never rounded for cache keys.

Coarse horizons precede the original solar contact search, which selects the same fine rays, followed by the original final contact profile and disk checks. Mathematical ordering and maximum tie decisions stay unchanged. No IndexedDB schema upgrade can block an older open tab's active analysis. Failed source writes remain visible and cannot cause endless repeated downloads.

The build also hashes computational source files and the dependency lockfile. This fingerprint namespaces result caching, including uncommitted builds, and is exported as algorithm. Restart the development server after computational source changes to refresh its build fingerprint.

Version 0.9.1 writes native source bytes into Blob-backed entries in the existing store under separate keys. Reads still return identical ArrayBuffers. The old entry identity is recorded, so a later import by an old open tab supersedes its Blob shadow. One lost official file may be recovered per run with an identical source SHA-256; local sources and changed bytes are never silently substituted. Permanent storage errors retain a bounded stop with diagnostic cause.
