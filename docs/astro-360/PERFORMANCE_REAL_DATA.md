# Real browser/third-product results

Round2 native bilinear envelope measured at code commit2cd2654, algorithm cc5b704079e71d737909b887a7c802fffed588c1c0fb0e88d5996616a5beacd0, Chromium153.0.8010.12. Public Olympiapark desktop and Bamberg Pixel7 context; terrain100m, DOM10m,12 rays, point step10m, position1m+horizontal optics0.3m, vertical0.1m, optics±0.2m, DGM error0.2m/DOM0.6m as assumptions. Native budget200000; stress1000 includes ground interval cells. All sectors conditional projected model, not physical true-north certificate.

| Public site | Cache/state | Browser wall ms | DGM cells | DOM cells | Downloads |
|---|---|---:|---:|---:|---:|
| Olympiapark public reference | cold | 18825 | 33051 | 10486 | 2 |
| Olympiapark public reference | warm | 363 | 33051 | 10486 | 0 |
| Olympiapark public reference | cell-budget-stress | 304 | 962 | 0 | 0 |
| Bamberg public reference | cold | 11332 | 33049 | 10490 | 2 |
| Bamberg public reference | warm | 376 | 33049 | 10490 | 0 |
| Bamberg public reference | cell-budget-stress | 345 | 962 | 0 | 0 |

Cold ZIP consumed bytes:47,257,231 /48,989,310; warm/stress0. Warm persistent tile cache reused identical file hashes; no result-cache trick. Main-page heap measurements exclude workers and are not full memory profiles. Other local processes/validation ran concurrently. No broad-radius/statewide speed estimate is implied. Source/source-block metrics and cell elapsed fields in evidence/round2/browser-multisite.json. Previous constant-footprint prototype retained separately; not substituted for this final bilinear model.

LoD2 official2km tile688_5338.gml:44,381,303 raw bytes,ZIP2,958,115 bytes; original source hash5148292892b8f972d1b17cf4ffc60f790e2ea6902703b4a941d71ae6703bbc6d.24 closest unique roof vertices,77.67..91.77m from the public reference, compared to DGM/DOM matching original hashes. DOM–LoD2 min -39.61487529296994m,max0.2677257690703527m. These are edge comparisons outside the10m DOM browser-horizon scope, not an asserted physical error interval. File declares DHHN2016; acquisition independence/date unverified. Edge interpolation/capture/occlusion/model geometry need review. Agreement NOT_ACCEPTED; no on-site or LAZ validation exists.
