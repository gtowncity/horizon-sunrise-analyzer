# Performance

Downloads and CPU work run in a worker. Compressed TIFF bytes persist in IndexedDB; decoded float32 rasters use a 256 MiB LRU budget. DGM1 decode is approximately 4 MB per tile, DOM20 approximately 100 MB, independent of compressed transfer size. Temporary decoder copies and result objects mean total process memory exceeds this cache budget.

A real 200 m Chromium test measured about 2.5 s for cold DGM1, 0.35 s for a repeat, and 7.0 s for DOM20 including its first download. These are one-machine observations, not performance guarantees. The private study benchmarks 1/10/40/80 km and a solar fan and records download bytes, decode times, process RSS and cache behavior separately. Process RSS is a sampled process-memory measure, not a precise browser heap peak.

A sunrise fan costs rays × samples. The contact region receives additional fine angular rays; at most 32 near-leading spatial maxima per ray receive quarter-step samples. Small angular steps and long-range full DOM can be expensive. Cancellation terminates the worker; completed cache entries survive. No statewide raster or basemap prefetch is performed.
