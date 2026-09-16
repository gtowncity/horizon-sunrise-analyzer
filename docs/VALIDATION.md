# Validation

Three separate evidence levels are maintained: analytical unit tests, deterministic browser fixtures, and actual official-data integration. Synthetic fixtures exist only under tests/. They validate execution, not real geography. The private audit stores raw TIFFs, checksums, independent solar references, network traces, parameter sweeps and screenshots.

The test suite covers CRS round trips and a UTM central-meridian invariant, interpolation/cell centers/NoData/tile seams, ellipsoidal direct–inverse distances, finite sector coverage, curvature/control formulas, k sensitivity, solar radius, IANA DST, scalar first crossings, tangent disks and narrow notches. Actual reference height agrees with the independent user-supplied value to better than 1 mm numerically. This agreement is not evidence of millimetre physical DGM accuracy.

Five independent NOAA/USNO comparisons passed the stated angular/minute thresholds. For scientific release 1.0, remaining gates include cross-ray/spatial convergence bounds, the vertical-model uncertainty budget and a comprehensive physical interpretation of partial surface data. Therefore the released version remains 0.9.0.

## Numerical equality and runtime differences

Old versus optimized calculations matched exactly within Node and within Chromium; no equality-test tolerance was widened. Comparisons include all real 4 km profile fields and the real 20 km contact profile (20,007 points), plus representative horizon blockers and synthetic complete solar fans.

Node 24 versus Chromium 153 was not bitwise identical. The unchanged geodesic function already differed by one latitude ULP (7.11e-15 degrees) before raster access; a traced projected coordinate differed by 1.86e-9 m. These runtime/build rounding differences propagate through interpolation. Across the full exported scientific fields, maximum observed differences were 6.22e-10 m in DGM height, 1.242e-8 m in DOM height and 3.534e-9 degrees in surface angle. Among changed DOM values the mean absolute difference was 7.91e-11 m. Contact time, time bracket, sample distances, selected blocker distances and visibility were identical. This cross-runtime comparison is documented separately and is not silently converted into an exact-equality pass.
