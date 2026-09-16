# Performance

## Implementation and measurement rules

Since 0.9.0, independent rays share native TIFF-block reads within bounded waves. The prior 256 MiB whole-raster cache repeatedly evicted DOM tiles (100 MB decoded each). The production provider instead budgets 192 MiB for open original files and 96 MiB for decoded blocks. Active reads, ZIP/decoder buffers, query plans, JavaScript objects and garbage collection are additional memory: these budgets are not a process-memory limit. Small-memory/mobile devices remain more constrained than the measured desktop.

Two file pipelines allow service/file waits to overlap. A one-versus-two pipeline warm subset check found no meaningful CPU-only gain; two is a conservative I/O-overlap limit, not a claim that more parallel decoding is faster. No unbounded worker pool is used. TIFF block sizes and strips are read from metadata. Whole-image strips can still require a whole-image decode.

Original ZIP downloads remain complete files. Native-window decoding reduces raster work, not bytes sent by the official ZIP service. ZIP response payload bytes, extracted TIFF bytes, decoded arrays and cache reads are different quantities. MB is decimal; MiB is binary. Per-stage asynchronous durations overlap; only monotonic total wall time measures total duration.

## Cache states

- New sources: requires the official service; application cache freshness says nothing about HTTP/OS/server caches.
- Original TIFFs present: saves download/service time, but still computes all profiles and solar contact.
- Prepared profiles: no persistent profile cache in this release. Block reuse is bounded within one worker run.
- Identical finished result: validates inputs, algorithm/build identity and every stored source fingerprint/provenance, then reuses the result. This is clearly labelled and is not a fresh computation. Validation reads original files sequentially and is not free.

Cancellation terminates the analysis worker; completed original files remain available. Failed persistent writes are reported; evicted unsaved files cannot cause an endless download loop. Progress reports current phases and observed work, without a speculative ETA or pretending a per-file 100% is overall completion.

## Limits and further work

The current bounded waves intentionally trade repeated block reads for bounded live profile memory. Cross-wave source reads and repeated strip decoding remain measurable. A future compact all-ray query plan or carefully budgeted persistent derived-block cache could reduce that work, but requires new equality and storage-quota proofs. A server-side/native-resolution range-access source could reduce transfers only if its real format, availability and browser CORS behavior are verified. Seconds for entirely new full-DOM data are not promised.

All previous 1.5–3 hour and roughly ten-minute full-run figures were planning estimates. No complete old 20 km run is performed merely to establish a ratio. Scientific sampling, atmosphere, finite search range and the limitations in LIMITATIONS.md are unchanged.

## Recorded 20 km verification (2026-09-16)

One private reference case used full DOM20 + DGM1, 1 m distance spacing, a 0.1 degree initial azimuth grid and the unchanged adaptive refinement. It actually required 81 coarse and 40 additional rays, plus the final contact profile. Coordinates are private; the reference date was explicitly adopted from the prior user export, not read from a live running browser.

| Measurement | Cache state | Observed wall time |
| --- | --- | --- |
| Three neighbouring real 4 km profiles, old implementation, Node 24 (two runs) | Original TIFFs present; new provider each run | 79.12–84.74 s |
| Same three profiles, optimized, Node 24 (two runs) | Identical original TIFFs; no prepared/result cache | 1.813–1.865 s |
| Complete optimized 20 km fan, Node 24 (one run) | Resumed after service failure; 25 DGM sources already present | 536.48 s |
| Complete optimized 20 km fan, Node 24 (one run) | All original files present; no derived results | 265.26 s |
| Complete optimized 20 km fan, Chromium 153 (one run) | Isolated context, original TIFFs seeded; no derived results | 180.59 s |
| Identical completed result, Chromium 153 (one run) | Result plus all original files present | 2.394 s |

The subset gain is about 44.5x (ratio of two-run means). It is not a measured whole-fan gain. Subset file openings fell from 37 to 12 and 37 whole-raster decodes were replaced by 391 native-block reads. Both subsets downloaded zero bytes. Total fresh-source payload across the failed and resumed attempts was 1,386.50 MB (1,322.27 MiB), yielding 1,397.88 MB of TIFF files. The resumed run alone downloaded 1,326.16 MB. Window decoding itself avoided zero ZIP downloads.

The first initially empty source-cache attempt failed after about 36 s at an official ZIP-start HTTP 400. Its 25 downloaded DGM files were retained; the resumed run is not an uninterrupted cold measurement. No full old fan was run, and no defensible whole-fan speedup factor is claimed from the earlier 1.5–3 h planning estimate. The earlier 1.6 GB workload estimate also differs from the actual 102 files (51 per model).

Node measurements used Windows, an Intel i7-11700K (8 cores/16 logical processors), approximately 64 GiB RAM and Node 24. Sampled peak RSS was 919 MiB in the resumed full run and 692 MiB in the file-warm Node run. Chromium memory was not measured. Its 10.26 s test-fixture seeding time was excluded from the warm calculation and reported separately; no external data transfers were allowed in those browser runs. OS/HTTP/server caches were not controlled. These are bounded single-machine observations, not performance guarantees or confidence intervals.

Numerical equality was evaluated within the same runtime. The separate Node/Chromium comparison exposed small implementation-dependent rounding in unchanged geodesic calculations before raster access; see VALIDATION.md. It did not justify changing test tolerances or sampling settings.
