# Horizon function H(A)

Each stored point contains azimuth, maximum angle and its real sample: distance, latitude, longitude, DGM/DOM elevation and tile ID. H(A) is linearly interpolated only inside the computed fan. Requests outside coverage fail instead of extrapolating fabricated terrain.

The solar fan is centered on the standard-rise azimuth, with configurable half-width and angular spacing. Only a time interval whose full disk remains inside that fan is searched. If a contact cannot be bracketed, increase the fan or inspect whether the body was already visible at the interval start.

Angular sample spacing can dominate error: at 40 km, 0.1° separates rays by about 70 m. A narrow ridge or notch between rays can be missed. After a nominal contact, its ±0.5° region is adaptively resampled at 0.01–0.02° and the contact is solved again. The time shift is exported as angularRefinementSeconds. No rigorous cross-ray error bound is asserted. The finite-ray engine, scalar interpolation tests and narrow-notch disk tests validate the implemented model; additional field/convergence validation is needed for a scientific 1.0 release.
