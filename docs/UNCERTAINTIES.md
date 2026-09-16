# Uncertainty budget

| Term | Treatment |
|---|---|
| DGM1 vertical error | Product figure better than ±0.2 m; site-specific validity unproven |
| DOM20 error | Product 0.4–0.6 m, canopy/occlusion/date caveats |
| Instrument/ground height | Explicit inputs; private scenarios recalculate horizon maxima |
| Position | User radius retained, no claimed probabilistic spatial interval |
| Spatial and azimuth sampling | Configurable; finite coverage and unresolved-peak limitations visible |
| Earth/vertical datum | Local GRS80 normal-section; missing geoid slope and vertical deflection |
| Terrestrial atmosphere | k scenarios; not a measured atmosphere |
| Solar refraction | Pressure/temperature scenario, potentially dominant near horizon |
| Ephemeris | Upstream ±1 arcminute target; independent checks below that |
| Missing objects/age | No live vegetation or cloud observation |

The UI computes contact shifts for ±0.1° uniform horizon perturbations when bracketable. These are sensitivity scenarios, not a probability distribution or a complete confidence interval. A useful local linear relation is δt≈δθ/(dh_sun/dt−H′(A)*dA/dt), but at blocker switches and tangencies this approximation can fail.
