# Scientific model

Input coordinates are longitude/latitude in EPSG:4326. A GRS80 UTM32 projection samples official EPSG:25832 rasters. GeographicLib traces a WGS84 ellipsoidal geodesic at the entered true-north initial azimuth. WGS84-to-ETRS89 is treated as a static approximation without an epoch-dependent deformation model.

Observer eye normal height is H0 + instrument height + optional explicitly artificial ground offset. Terrain angle is computed using a local GRS80 normal-section radius and an effective-radius terrestrial k correction. This is an ellipsoid-informed local model, not a full ECEF/geoid/plumb-line solution.

For each azimuth, H(A) is the maximum computed angle over samples in the requested distance interval. The solar model computes an unrefracted topocentric center, a distance-dependent angular radius, individual refracted limb rays, and their largest clearance above interpolated H(A). A sign-change search finds first visibility within the searched time window. See EARTH_CURVATURE, SUN_DISK_CONTACT and UNCERTAINTIES for equations and limits.
