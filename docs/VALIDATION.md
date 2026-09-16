# Validation

Three separate evidence levels are maintained: analytical unit tests, deterministic browser fixtures, and actual official-data integration. Synthetic fixtures exist only under tests/. They validate execution, not real geography. The private audit stores raw TIFFs, checksums, independent solar references, network traces, parameter sweeps and screenshots.

The test suite covers CRS round trips and a UTM central-meridian invariant, interpolation/cell centers/NoData/tile seams, ellipsoidal direct–inverse distances, finite sector coverage, curvature/control formulas, k sensitivity, solar radius, IANA DST, scalar first crossings, tangent disks and narrow notches. Actual reference height agrees with the independent user-supplied value to better than 1 mm numerically. This agreement is not evidence of millimetre physical DGM accuracy.

Five independent NOAA/USNO comparisons passed the stated angular/minute thresholds. For scientific release 1.0, remaining gates include cross-ray/spatial convergence bounds, the vertical-model uncertainty budget and a comprehensive physical interpretation of partial surface data. Therefore the released version remains 0.8.1.
