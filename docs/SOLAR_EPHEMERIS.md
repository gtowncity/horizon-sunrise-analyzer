# Solar ephemeris

Calculated with Astronomy Engine 2.1.19 (MIT), using its topocentric Equator(Sun, ofdate=true, aberration=true) and unrefracted Horizon transform. Upstream uses truncated VSOP87 and comparison against NOVAS and JPL, with an advertised angular target of ±1 arcminute. This is not a claim that local terrain visibility shares that accuracy.

The observer's ellipsoid height is set to zero intentionally: NHN is not silently treated as an ellipsoid height. For a 3 km height change, the induced solar-parallax change is of order 0.004 arcsecond. Dynamic angular radius is asin(695700 km / Earth–Sun topocentric distance), with AU=149597870.7 km.

Local validation uses the independently downloaded NOAA implementation and live USNO API responses for five dates/locations. Standard-rise deviations from NOAA were 0.12–1.64 s; sampled altitude/azimuth/declination differences were below 17 arcseconds. USNO sunrise values were consistent within its minute rounding. NOAA is a comparison, not the production ephemeris engine.
