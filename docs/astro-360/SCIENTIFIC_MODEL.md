# Scientific model and acceptance criteria

True geographic north = 0°, east = 90°, clockwise positive. H(A) is the maximum angle of valid investigated obstructions inside a finite domain; a sampled lower estimate is not the continuous true horizon. Terrain and surface domains are independent. Negative angles remain negative. Missing data is null, never zero.

Use the unchanged core/geo.ts GeographicLib WGS84 directions and EPSG:25832 projection. GRS80 normal-section effective-radius geometry uses R_eff=R/(1-k), theta=d/R_eff, u=h-h_eye-2(R_eff+h)sin²(theta/2), v=(R_eff+h)sin(theta), alpha=atan2(u,v). Heights are DHHN2016 normal heights, not ellipsoid heights. This local effective-radius approximation omits geoid slope and deflection of the vertical. k is terrestrial only; no astronomy/solar dependency.

Eye height is either ground + relative optical height OR explicit absolute DHHN2016 height. Never add relative height to the absolute value. H_use=max(H_sampled+specifiedMargin,userMinimum). Specified margin is not a confidence interval and cannot make an incomplete sector safe.

For flat earth independent controls use atan2(deltaHeight,d); for curvature controls compute spherical Cartesian coordinates with cos(theta) (different numerical expression) and document tolerance. Relative height uncertainty e gives approx angular sensitivity atan(e/d), e.g. 0.6 m at 10 m ≈3.434°; at 100 m ≈0.344°. These are sensitivities, not physical accuracy measurements.

Adaptive angle/distance sampling may find visible peaks but cannot bound unseen chimneys without spatial bounds. No sampled implementation may return COMPLETE until exhaustive cell-footprint bounds, NoData checks and convergence bounds are demonstrated. Record sampled radial interval, gaps, evaluated sample counts and unresolved angular gap. An apparently converged midpoint cannot exclude an arbitrarily narrow peak. UNKNOWN means no valid estimate; INCOMPLETE means estimate with unresolved spatial/angular extent. COMPLETE is reserved and not issued by the initial adaptive engine.

Real-world release requires official tiles at multiple public locations, known hashes and acquisition dates where supplied, independently computed references and declared observer/vertical/optical uncertainties. DOM20 is a photogrammetric surface, not a classified building/tree model. Further objects outside the domain and current vegetation remain unknown.
