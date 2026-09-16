# Terrestrial refraction

k is the assumed ray-curvature ratio relative to terrestrial curvature. The effective-Earth method R/(1−k) accounts approximately for a vertically stratified refracting atmosphere. Default k=0.13 is a scenario choice, not a physical constant. k=0 disables it; UI range is 0–0.5.

At fixed range, increasing k decreases the curvature drop and raises the apparent terrain angle. Tests cover 0, 0.07, 0.13 and 0.20 and verify this monotonic behavior. The private reference study recomputes maxima from the complete stored rays for these scenarios, so blocker changes remain possible.

Inversions, mirages, path-dependent gradients and time variability are not modeled. Terrestrial k is never reused for astronomical refraction. A single k cannot establish the actual atmosphere at observation time.
