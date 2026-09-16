# Testing

Use Node 24 and npm. Run npm ci, npm run lint, npm run typecheck, npm test, npm run build. Install Chromium with npx playwright install chromium, then npm run test:e2e. Linux CI uses --with-deps.

Vitest executes numerical and actual GeoTIFF decoding tests; fake-indexeddb validates persistence. Playwright serves the production build, tests desktop/mobile inputs, sightline, profile, sunrise, export, errors and cancellation. Network fixtures intercept only official-data endpoints and generate analytical TIFF planes. They never enter dist.

Actual network integration is deliberately separate from every CI push: the public services can be slow or unavailable and repeated downloads should be limited. Local private scripts exercise real ZIP/CORS and DGM/DOM browser analysis, with no fixture interception. Inspect the local audit for full reports. Console exceptions and failed first-party asset requests must also be checked in final production smoke tests.

Version 0.9.0 retains the mathematical reference engine from commit 625dc2618c74aa67c5c826279a9785cc25d2c592 in tests/reference (only import paths adapted). Exact structural comparisons cover DGM-only/full-DOM solar outputs, all profile fields, H(A), adaptive points, contact, sensitivity and scientific warnings. Full/partial DOM profiles are compared separately. Raster fixtures cover different native block sizes, strips, partial edge blocks, file seams, reordered/duplicate queries and weighted/zero-weight NoData. Changed sources, inputs and commit invalidate saved results. Browser tests cover explicit result reuse, cancellation and export; the 0.8.1 chart-gap regression remains.

Real-data comparisons are bounded: no old full 20 km fan; each old subset run at most 120 s, baseline runs at most six minutes combined, full optimized attempt at most 15 minutes and about 30 minutes total performance experiments. A timeout is incomplete. Identical original TIFFs, inputs and cache states are necessary for a processing-speed comparison. Synthetic data are confined to tests.
