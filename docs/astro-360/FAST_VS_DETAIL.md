# FAST versus DETAIL

FAST defaults: 10° initial, 1° minimum azimuth, 10 m terrain step, DOM step min(terrainStep,2 m), 144 rays, 100000 samples. DETAIL selects 5° initial, 0.5° minimum, 1 m terrain, DOM min(terrainStep,0.5 m), 360 rays, 500000 samples. All can be adjusted within validated budgets. Both have first midpoint scan; subsequent refinements target observed angular edges and radial sampled peaks. No completeness assertion follows from lack of observed differences.

At identical effective settings/source inputs both modes agree (synthetic terrain regression). No claimed speedup. Tiles decoded with native blocks but whole original archives downloaded by existing official loader. Preliminary estimates are tile upper bounds; byte volume unknown. No performance extrapolation from tiny references.
