# Testing

Use Node 24 and npm. Run npm ci, npm run lint, npm run typecheck, npm test, npm run build. Install Chromium with npx playwright install chromium, then npm run test:e2e. Linux CI uses --with-deps.

Vitest executes numerical and actual GeoTIFF decoding tests; fake-indexeddb validates persistence. Playwright serves the production build, tests desktop/mobile inputs, sightline, profile, sunrise, export, errors and cancellation. Network fixtures intercept only official-data endpoints and generate analytical TIFF planes. They never enter dist.

Actual network integration is deliberately separate from every CI push: the public services can be slow or unavailable and repeated downloads should be limited. Local private scripts exercise real ZIP/CORS and DGM/DOM browser analysis, with no fixture interception. Inspect the local audit for full reports. Console exceptions and failed first-party asset requests must also be checked in final production smoke tests.
