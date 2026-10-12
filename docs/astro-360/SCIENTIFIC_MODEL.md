# Scientific model

H(A) in true geographic north is the supremum of obstruction angle in a declared finite domain. The primary curve is only a nominal sampled maximum, not a certified continuous physical horizon. Schema astro360-3 explicitly tags actual=NOMINAL_SAMPLED_MAXIMUM and planning=NOMINAL_SAMPLED_REFERENCE_NOT_SAFE. A user minimum/reserve cannot turn it into a safe curve.

The original GeographicLib WGS84 / GRS80 effective normal-section model stays unchanged. R_eff=R/(1-k); theta=d/R_eff; u=h-eye-2(R_eff+h)sin²(theta/2); v=(R_eff+h)sin(theta); alpha=atan2(u,v). DHHN2016 normal heights are not ellipsoidal heights. Geoid slope/vertical deflection and actual atmospheric stratification remain unmodeled. Terrestrial k is not astronomical refraction.

DETAIL traverses original native pixel values and encloses each bilinear basis support: for resolution r, a native center can contribute within a square of half-width r. Bilinear weights are nonnegative and sum to one, so height at any supported point is no greater than the maximum contributing native height plus its assumed error. This is broader than a constant PixelIsArea half-width r/2. A circle encloses the support square plus observer/optical disk; all intersected sectors receive the bound. Incomplete traversal invalidates full bounds everywhere; NoData marks affected supports UNKNOWN. Known-subset bounds remain separate.

Current cell sectors use EPSG25832 grid north/distance, explicitly not certified true geographic sectors. They are shown separately from the geographic curve. See FORMULAS_AND_UNITS.md for interval inequalities. Conditional numerical dominance tests use independent Cartesian geometry; they are not physical validation, capture completeness, a statistical interval or a directed-rounding proof.

Scientific release BLOCKED. NINA export DENIED for all supported schemas. Full geographic/physical coverage NOT_CERTIFIED; no on-site measurements. Current partial model and acceptance gates: ADR-0002-fail-closed-native-cells.md and ROUND2_STATUS.json.
