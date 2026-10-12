# Architecture

Feature isolated in src/features/horizon360: types.ts, engine.ts, horizon.worker.ts, export.ts, Horizon360.tsx, Charts.tsx and Map.tsx. Core geo/provider/cache shared unchanged. Original engine/solar/raster/exports untouched. App integrates three main navigation choices; original analysis state stays in App, new worker terminated on cancellation/unmount.

Source records use original downloaded hashes; no result persistence implicit. Streaming ray batches max 512 points; radial peak candidates max 8; ray/sample limits explicit. Download loader budgets count new attempted tiles, avoids repeatedly failed tiles and reserves 150 MiB per next archive. Existing loader checks archive size after transfer; hence pathological response transfer size cannot be strictly limited before receipt. No server speed assumptions. Real memory metrics only cache source/block sizes, not full browser heap.

See ADR-0001 for complete-sector gate and rejected unrestricted exhaustive DOM loop.
