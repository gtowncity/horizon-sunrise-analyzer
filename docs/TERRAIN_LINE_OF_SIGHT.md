# Terrain line of sight

For initial azimuth A and distance d, GeographicLib.Direct supplies each sample location on a geodesic. The final point is included exactly even when the interval is not divisible by the step. Distances are ellipsoidal ground distances in metres. The observer sample supplies ground height but is excluded from the angular maximum.

A complete uniform fine scan is followed by local refinement around up to 32 local maxima within 0.05° of the leading angle. Each candidate neighborhood is sampled at one quarter of the input step. The complete base scan is retained. This reduces aliasing without claiming a coarse-candidate scan cannot miss peaks. Default spacing is 1 m; 0.2–50 m is configurable. A comparison with half the spacing is a convergence experiment, not a universal proof. A peak between ray samples can remain underestimated; near-field objects particularly require fine sampling.

The horizon is the greatest apparent angle, not the highest absolute elevation. The target-ground visibility check compares intermediate sample angles to the endpoint angle. It assumes zero target height and reports only the selected finite range. NoData anywhere required by the profile aborts the result.
