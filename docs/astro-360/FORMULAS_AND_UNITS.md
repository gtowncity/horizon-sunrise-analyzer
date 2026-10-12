# Formulas, bounds and units

All local lengths in metres, azimuths/heights in degrees; true north clockwise for sampled rays, EPSG25832 GRID_NORTH for the separate cell report. Bytes versus MiB (2^20) remain distinct. Pixel resolution stays 1 m / 0.2 m; bilinear support width is 2 r, not a resolution/accuracy claim.

GRS80 a=6378137 m, f=1/298.257222101, e²=f(2-f), M=a(1-e²)/(1-e²sin²lat)^(3/2), N=a/sqrt(1-e²sin²lat), R=1/(cos²A/M+sin²A/N). Global R_min=a(1-e²); R_eff,min=R_min/(1-k).

Let D be cell-center distance in the declared projected model, rho=sqrt(2)*supportWidth/2+observerRadius, d_lo=max(0,D-rho), d_hi=D+rho. Cell height h_up=nativeHeight+assumedHeightError; delta_up=h_up-eyeMin. Since u<=delta_up and sin(t)>=t(1-t²/6), a lower horizontal bound is d_lo*(1-200/R_eff,min)*(1-(d_hi/R_eff,min)²/6), using supported heights [-100,4000] m and errors <=100 m. Upper horizontal bound is d_hi*(1+max(0,h_up)/R_eff,min). For delta_up>=0 use the lower denominator; for negative delta_up use the upper denominator. If d_lo=0 and delta_up>=0, 90° is a mathematical possible interception, not a NoData substitute. Unsupported data/ranges return null. All d_hi<=100 km.

Angular enclosure uses a circle and asin(rho/D), both seam-adjacent sectors included. Observer inside the circle affects every sector. These planar angular bounds are conditional; projection metric error/meridian convergence/datum uncertainties need certified geographic enclosures before use as true-north horizons. Independent controls allow 1e-7° numerical residual, not a verified physical angular error. Outward interval rounding is a remaining acceptance gate.

Scientific release BLOCKED. NINA export DENIED for all supported schemas. Full geographic/physical coverage NOT_CERTIFIED; no on-site measurements. Current partial model and acceptance gates: ADR-0002-fail-closed-native-cells.md and ROUND2_STATUS.json.
