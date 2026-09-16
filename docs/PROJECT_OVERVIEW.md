# Project overview

Horizon Sunrise Analyzer is a static scientific workbench for Bavaria. It computes line-of-sight profiles and finite-range terrain horizons from official DGM1 data, optionally compares DOM20, and solves solar-disk emergence across an azimuth-dependent horizon. No production fixture or synthetic-elevation fallback exists.

Release 0.8.1 is a research release. Working numerical models do not establish a universal physical error bound. In particular, spatial/angular sampling, missing distant terrain, near-horizon atmosphere and current vegetation limit predictions. Do not interpret displayed seconds as second-level observational accuracy.

The complete application runs in a browser worker and can be hosted on GitHub Pages. Public documentation contains no private reference location; raw scientific reconstruction lives in the ignored local audit.
