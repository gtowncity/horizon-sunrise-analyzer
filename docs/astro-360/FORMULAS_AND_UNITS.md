# Formulas and units

Distances, normal heights and uncertainty inputs in m; angles in degrees; true north clockwise; bytes are raw bytes, UI MiB = 2^20 bytes. See SCIENTIFIC_MODEL.md for effective-radius spherical formula. GRS80 radius: R=1/(cos²A/M+sin²A/N); M=a(1-e²)/(1-e²sin²lat)^(3/2), N=a/sqrt(1-e²sin²lat). f=1/298.257222101, a=6378137 m.

WGS84 geographic directions to EPSG:25832 through existing geo helpers. Horizontal reference system differences and normal/ellipsoidal height differences are not treated as zero physical error. JSON numbers are binary64, exports preserve values; decimal NINA rounding 8 places is numerical precision only. Independent reference uses Cartesian cos(theta), unlike stable production half-angle expression; tests allow 1e-7° at selected 100 m cases to cover cancellation.
