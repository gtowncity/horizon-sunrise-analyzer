# Raster and sector coverage

Reuse native GeoTIFF block queries from BatchedProvider, EPSG25832 PixelIsArea and bilinear interpolation at requested points. No full raster decode in measured probes. Each source scan records requested radius, farthest valid distance, attempted/valid counts, maximal radial gap, blocker and source errors. Angular gaps are cyclic and sum to 360°. Missing source is UNKNOWN, valid sampled estimate INCOMPLETE. Effective max can be non-null when one source is missing; NINA export refuses such missing requested source corridors.

Gap is a sampling metric, not a certified error. Detail is currently adaptive only; all physical sectors remain INCOMPLETE. Ground NoData fails the run. Further per-tile partial retrieval and complete-cell footprints require follow-up. Geographic search envelope covers Bayern and surrounding regions; administrative membership is not verified. Cross-border or absent tiles are explicit data errors.
