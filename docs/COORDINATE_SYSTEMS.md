# Coordinate systems

UI order is latitude then longitude; proj4 receives [longitude, latitude]. Raster axes are easting then northing, in metres. The provider checks ProjectedCSTypeGeoKey=25832, ProjLinearUnitsGeoKey=9001 and GTRasterTypeGeoKey=1. It also checks pixel resolution, 1 km extent and expected tile ID. Unknown CRS and PixelIsPoint imports are rejected.

For PixelIsArea, cell centers are origin + (column+0.5)*resolution and top - (row+0.5)*resolution. Using the corner as a sample location introduces a half-pixel offset. Neighbors outside a tile are obtained from the actual neighboring tile; edge values are never clamped.

DGM1 source documentation specifies DHHN2016 normal heights. DOM is interpreted in the official Bavarian vertical frame; individual inspected files contain no vertical GeoKey, a metadata limitation recorded in the local audit. The application never feeds these normal heights into an ECEF transformation as though they were ellipsoidal heights. Epoch-dependent WGS84/ETRS89 displacement and vertical deflection remain uncertainty terms.
