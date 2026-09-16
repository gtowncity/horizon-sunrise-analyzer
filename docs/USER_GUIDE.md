# User guide

1. Set observer latitude/longitude or choose Observer and click the map. Drag markers to move them. Coordinates outside the approximate Bavarian envelope are rejected; exact border coverage is determined by data availability.
2. Set eye height above local terrain. For a sightline, enter azimuth and distance, a target coordinate, or click Target.
3. Choose DGM1 or DOM20. Critical DOM is explicitly partial; use full mode to sample the whole selected corridor.
4. Start analysis. The service packages only required tiles; first downloads may take time. Progress and per-tile states show what is happening. Cancel if necessary.
5. Read both height and angular profiles. The blocker is the largest angle; absolute height alone does not determine visibility.
6. For sunrise, choose date/time zone and a suitable fan. Compare the standard horizon time with the modeled full-disk contact. Read sensitivity and coverage limits.
7. Export JSON for reproduction, CSV for every profile point, or chart PNG. JSON contains coordinates; decide where to share it.

Local GeoTIFF import accepts validated single official-layout tiles for the selected model. It labels local provenance as unverified. Clear the cache to refresh source files. Dark mode, keyboard controls and tabular values are available.
