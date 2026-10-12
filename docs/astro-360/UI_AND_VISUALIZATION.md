# UI wireframe and interaction contract

Header / three main navigation buttons: Sichtlinie | Sonnenaufgang | 360°-Horizont.

360 panel: observer + optical height / FAST vs DETAIL / separate terrain & DOM radius / min altitude & margin / advanced model + budgets / start-cancel.

Primary full-width diagram: 0..360° horizontal, height degrees vertical; DGM, DOM, sampled effective maximum, planning reference, user minimum. Missing angles break lines; all sampled corridors carry INCOMPLETE hatching. No peak smoothing. Zoom/pan via ECharts. A shared selected azimuth drives the diagram cursor, polar radial indicator and map direction/blocker. Keyboard azimuth input provides an accessible equivalent. North seam repeats the exact 0° point only for rendering.

Secondary polar dome: N top, E right, zenith center, altitude rings; unknown/incomplete zones explicit. OSM map: observer draggable, investigated radius and selected blocker. DOM/DGM only as source categories, no fabricated tree/building classifications. Accessible table preserves exact point values and source/coverage details; exports retain scientific points rather than smoothed graphics.
