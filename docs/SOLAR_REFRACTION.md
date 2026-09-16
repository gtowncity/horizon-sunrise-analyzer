# Astronomical refraction

The optional solar correction follows NOAA's piecewise geometric-altitude formula: 0 above 85°; (58.1/tan h − 0.07/tan³h + 0.000086/tan⁵h)/3600 between 5° and 85°; (1735 − 518.2h + 103.4h² − 12.79h³ + 0.711h⁴)/3600 between −0.575° and 5°; otherwise −20.774/(3600 tan h). Angles h in the polynomial are degrees; tangent inputs are converted to radians.

Scale by (P/1010)*(283/(273+T)), with P in hPa and T in °C. Defaults are 1010 hPa and 10 °C. This is an idealized correction; extrapolation below the astronomical horizon has limited observational validity.

Each solar-limb point is corrected at its own geometric altitude. Applying the center's correction to the entire disk gives a measurably different upper-limb position. Neither implementation is fitted to an observed time. Strong near-horizon variability remains outside the numerical solver error.
