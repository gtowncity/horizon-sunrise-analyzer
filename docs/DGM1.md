# DGM1

Official DGM1 represents terrain without vegetation and buildings. The documented raster spacing is 1 m, in 1 km × 1 km GeoTIFF tiles (1000² samples). Laser-scanning acquisitions and updates vary spatially. Public product accuracy is better than ±0.2 m; that does not guarantee every steep, wooded, or interpolated cell.

Tile ID uses floor(easting/1000)_floor(northing/1000). The official metalink catalog confirmed this naming; TIFF georeferencing is checked independently. NoData in the inspected files is -9999. Only positive interpolation weights contribute to a NoData failure.

The local real-data test recomputed the supplied independent reference to sub-millimetre numerical agreement, using actual raster samples and the correct center convention. The public tests use analytical data at generalized locations. No private reference height is compiled into the production app.
