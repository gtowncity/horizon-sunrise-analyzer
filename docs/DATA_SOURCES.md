# Data sources and access

- [BVV DGM1 data notes](https://www.geodaten.bayern.de/odd/m/3/html/datenhinweise/datenhinweise_dgm.html) — Bayerische Vermessungsverwaltung. 1 m terrain, airborne laser scanning, DHHN2016. Retrieved 2026-09-16.
- [BVV DGM product](https://www.ldbv.bayern.de/produkte/landschaftsinformationen/gelaende.html) — LDBV. DGM1 height accuracy better than ±0.2 m; product specification is not a local error guarantee. Retrieved 2026-09-16.
- [BVV DOM product](https://www.ldbv.bayern.de/produkte/landschaftsinformationen/dom.html) — LDBV. 0.2 m surface raster from dense aerial-image correlation; stated positional/height accuracy 0.4–0.6 m. Retrieved 2026-09-16.
- [Official machine-readable catalog](https://geodaten.bayern.de/opengeodata/json/opengeodata_datensaetze.json) — BVV. EPSG:25832, 1 km tiles, CC BY 4.0, DGM1 ~4 MB, DOM20 ~30–50 MB. Retrieved 2026-09-16.
- [Official download application](https://geodaten.bayern.de/opengeodata/opendatadetail.js) — BVV. poly2metalink ZIP start/status/download workflow. Retrieved 2026-09-16.
- [Elevation REST API](https://geoservices.bayern.de/bvvapi/od/hoehen/openapi.json) — BVV. DHHN2016, 4000 points/request; CORS preflight failed in this environment. Retrieved 2026-09-16.
- [Solar calculation details](https://gml.noaa.gov/grad/solcalc/calcdetails.html) — NOAA GML. Meeus-based comparison and piecewise atmospheric refraction; no longer actively maintained. Retrieved 2026-09-16.
- [NOAA reference calculator source](https://gml.noaa.gov/grad/solcalc/main.js) — NOAA GML. Independent numerical crosscheck downloaded during validation. Retrieved 2026-09-16.
- [USNO API documentation](https://aa.usno.navy.mil/data/api) — US Naval Observatory. Independent minute-resolution rise/set API. Retrieved 2026-09-16.
- [Astronomy Engine](https://github.com/cosinekitty/astronomy) — Don Cross. MIT, truncated VSOP87, target angular accuracy ±1 arcminute, upstream NOVAS/JPL checks. Retrieved 2026-09-16.
- [GeoTIFF.js](https://geotiffjs.github.io/geotiff.js/) — GeoTIFF.js contributors. Browser decoding and georeferencing API. Retrieved 2026-09-16.
- [GeographicLib JavaScript](https://github.com/geographiclib/geographiclib-js) — Charles Karney and contributors. Ellipsoidal direct and inverse geodesics. Retrieved 2026-09-16.
- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) — GitHub. checkout@v6, configure-pages@v5, upload-pages-artifact@v4, deploy-pages@v4. Retrieved 2026-09-16.
- [setup-node](https://github.com/actions/setup-node) — GitHub. setup-node@v7 verified in official README. Retrieved 2026-09-16.
- [OSM tile usage](https://operations.osmfoundation.org/policies/tiles/) — OpenStreetMap Foundation. Visible attribution, browser caching, no bulk tile downloads. Retrieved 2026-09-16.
- [Bavarian vertical reference](https://www.ldbv.bayern.de/vermessung/satellitenpositionierung/raumbezug.html) — LDBV. DHHN2016 normal heights differ from GRS80 ellipsoidal heights. Retrieved 2026-09-16.

Direct TIFF hosts support HTTP 206 but did not send usable Access-Control-Allow-Origin. The catalog, ZIP status and ZIP download endpoints did pass actual Chromium CORS tests. The application therefore uses official server-side ZIP packaging, then extracts the original TIFF locally. This is an official-service alternative, not an unofficial proxy.

Raster acquisition dates are not supplied reliably in these downloads. ZIP Last-Modified is the archive generation time, not terrain acquisition time. Hashes identify bytes, not historical authenticity.
