# N.I.N.A. compatibility

Official documentation checked 2026-10-12: https://nighttime-imaging.eu/docs/master/site/tabs/options/general/#custom-horizon . It documents azimuth/altitude pairs, at least two pairs, interpolation between pairs, a comment header and matching 0/360 example. Export is ascending decimal azimuth then altitude, space separator, CRLF, 8 decimals, 360 repeats 0.

Tests parse numeric columns independently and enforce endpoints/order, explicit provisional consent, missing requested source rejection. Installed N.I.N.A. import and its exact rounding/interpolation behavior NOT_EXECUTED. Therefore compatibility is format-reviewed and locally tested, not app-validated. Interpolation may hide unobserved peaks. No guarantee for complete DSO or camera FOV; physical and planning files are explicitly VORLAEUFIG.
