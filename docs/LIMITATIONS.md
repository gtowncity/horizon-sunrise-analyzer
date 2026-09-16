# Known limitations

- Finite distances/rays do not prove an all-distance continuous terrain maximum. Candidate and contact-region refinement is implemented, but a global bound on unsampled cross-ray features is not claimed.
- Normal-section geometry is not a full ellipsoid/geoid/light-ray model. No epoch-specific WGS84/ETRS89 transformation is supplied.
- Critical DOM deliberately omits many surface cells; reported contacts in that mode are provisional. Full DOM can exhaust memory on small devices.
- Direct TIFF CORS and elevation API preflight failed; the official ZIP workflow currently works but is an external dependency. A local validated-file fallback is available.
- Cache uses manual invalidation; acquisition epochs and source changes cannot always be inferred from headers. ZIP dates are not survey dates.
- A 1 s contact scan can miss shorter visibility windows. Piecewise-linear angular interpolation can miss narrow cross-ray terrain features.
- Positions with nonzero uncertainty are recorded but a probabilistic best/worst/median disk analysis is not implemented.
- Chart tangent uses the small-angle drop control model for explanation; numeric results use the trigonometric model.
- No clouds, extinction, observer obstruction, transient objects or actual atmospheric measurements are included.

These are reasons for retaining the honest research version 0.8.1 rather than asserting a scientifically complete 1.0.
