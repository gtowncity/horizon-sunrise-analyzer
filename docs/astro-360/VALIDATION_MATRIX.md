# Validation matrix

Automated new tests: plane with k=0/0.13/0.5; near hill/roof height; mutable optical height; DGM/DOM separation; negative angles; NoData observer/obstacles; remote DOM failure; seam; hidden chimney honesty; angular edges; radial peak; budgets; abort; FAST/DETAIL equivalent sampling; JSON corruption/round trip; NINA consent/sort/endpoints; CSV null. Independent reference formula in tests/horizon360.test.ts. Existing provider/raster seams, PixelIsArea centers, range cache, decoder and frozen reference tests retained.

137 Unit tests passed in first complete current check. 8 E2E passed Desktop+Pixel 7: original sightline/sunrise/cache/export and new worker/chart/selection/export/cancel flows. ZIP verifier tests deliberately corrupt CRC, SHA and manifest entries. Deployment gates tested. See TEST_REPORT.md for dated exact logs.

NOT_EXECUTED: exhaustive 360 cell footprint upper bounds, manual overrides, shifted optics ensemble, LoD2/LAZ, installed NINA import, independent DOM edge geometry, rigorous accessibility audit, persistent cold/warm/resume real performance. Synthetic tests do not substitute for these gates.
