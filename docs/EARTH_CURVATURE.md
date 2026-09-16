# Earth curvature

For ellipsoid semimajor axis a=6378137 m, flattening f=1/298.257222101, e²=f(2−f), latitude φ and initial azimuth A:

N=a/sqrt(1−e² sin²φ); M=a(1−e²)/(1−e² sin²φ)^(3/2); R=1/(cos²A/M + sin²A/N).

With terrestrial refraction coefficient k, R_eff=R/(1−k). For target height H, eye height H_eye and θ=d/R_eff, across=(R_eff+H) sinθ; up=H−H_eye−2(R_eff+H) sin²(θ/2); angle=atan2(up,across). The half-angle expression avoids catastrophic cancellation for short distances. All computation is binary64.

The control approximation drop=(1−k)d²/(2R) is exported per sample and plotted. On an unrefracted sphere of radius 6,371 km, 40 km gives 125.56898 m drop. The local normal-section radius varies with direction and latitude; it does not include variation of curvature along the whole geodesic, geoid slope or deflection of the vertical.
