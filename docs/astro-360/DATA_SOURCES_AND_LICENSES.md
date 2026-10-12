# Sources and licenses

Source review 2026-10-12:
- DGM: https://digitalisierung.bayern.de/produkte/landschaftsinformationen/gelaende.html ; 1 m spacing, stated vertical accuracy better than ±0.2 m, not a per-pixel guarantee.
- DOM: https://www.ldbv.bayern.de/produkte/landschaftsinformationen/dom.html ; 0.2 m raster, stated positional/vertical accuracy 0.4–0.6 m, photogrammetric capture state.
- Download: existing src/data/provider.ts official Bayerische Vermessungsverwaltung catalog, EPSG:25832, PixelIsArea. Source hashes are supplied by existing loader. Fetch time is not acquisition date. Missing metadata remains missing.
- Attribution: Bayerische Vermessungsverwaltung – www.geodaten.bayern.de, CC BY 4.0; repository's existing project license applies to code.
- N.I.N.A.: https://nighttime-imaging.eu/docs/master/site/tabs/options/general/#custom-horizon ; azimuth altitude pairs, gaps interpolated, >=2 points, example has matching 0/360 endpoints. Format evidence reviewed; actual installed N.I.N.A. import not yet executed.

LoD2/LAZ are optional controls and not yet integrated. No on-site measurement claimed.
