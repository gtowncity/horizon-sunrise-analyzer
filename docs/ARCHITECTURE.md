# Architecture

React owns inputs, status, map and charts. A dedicated module worker owns downloads, ZIP extraction, GeoTIFF decoding, profile sampling and contact search. Terminating it implements cancellation. IndexedDB survives worker replacement. MapLibre has a separately bundled module worker.

Modules: src/core/geo.ts (projection/geodesics/curvature), raster.ts (interpolation), solar.ts (ephemerides/disk/root search), engine.ts (orchestration), export.ts (schema and CSV). src/data/provider.ts implements ElevationProvider independently of the UI; cache.ts supplies browser and in-memory stores. Tests use injected synthetic providers without changing production behavior.

Provider records track each used model/tile and distinguish Downloaded, Cached, Local, Loading and Failed. Failed data never become zero elevations. The UI discards the result on changed inputs. Exports preserve the inputs used in the actual calculation. See ADRs for alternatives.
