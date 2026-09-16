# Solar disk contact

Represent the disk limb as a spherical small circle of angular radius ρ centered at azimuth A and geometric altitude h. For limb parameter t, h_limb=asin(sin h cosρ + cos h sinρ cos t), and A_limb=A+atan2(sin t sinρ cos h, cosρ−sin h sin h_limb).

Compute 720 limb samples per time evaluation. Also evaluate the upper disk intersection at every horizon knot within the disk, to catch a narrow piecewise-linear notch that falls between limb samples. Refract each ray separately. The clearance function is max_limb(apparent altitude − H(azimuth)). Positive clearance means at least one disk point is visible.

Scan forward in 1 s increments for the first negative-to-nonnegative transition, then bisect to a bracket ≤50 ms. A 1440-point check at contact flags limb-discretization changes above 0.001°. This does not prove no subsecond transient opening was missed, nor does it bound terrain angular interpolation. Already-visible interval starts are reported rather than misidentified as contact. Standard sunrise is a separate unrefracted center crossing of −0.8333°.
