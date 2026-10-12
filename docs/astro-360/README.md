# 360° horizon — development register

Status: PARTIAL. No production deployment authorized. Work only on feature/astro-360-horizon.

## P0 baseline

Clean single-branch local clone from the requested public GitHub remote, HEAD 18c2cc303df73faf9424120188b56f8b12303f3d. Main observed remotely at 6b395610ceecaa8d0176432c697edfc384ae0823. Node v24.19.0, Windows x64. All eight commands were executed before changes; see audit baseline/report.json and complete logs. Unit: 98 pass; E2E: 4 pass. npm audit failed: GHSA-68fv-2mgg-jv7q, source-map-js, high severity. No other baseline failures.

Historical local development path: FOUND_WITH_SOURCE. An existing 2026-09-16 project directory contains _local_audit/ENVIRONMENT.md (0.8.0, commit 0455a900) and README_LOCAL_AUDIT.md. This verifies a historical development directory, not the provenance of an October 10 master archive. Historical private audits were not copied. Exact absolute local checkout and historical paths are recorded locally outside the public package. Original path strings from other chats are not evidence.

## Exit gates

P0: baseline recorded; inherited security failure requires fix.
P1: model, coverage, input schema, UI wireframe and architecture decisions specified before implementation.
P2-P4: implementation and tests in progress. Synthetic numerical validation does not prove real-world accuracy.
P5: multiple independent official DGM/DOM sites, browser CORS and physical controls mandatory before release.
P6: each session packages all current documentation and test evidence, with independent ZIP readback and checksum. A passing archive is not a scientific release approval.

See HANDOFF.md and MACHINE_READABLE_VALIDATION_REPORT.json in the audit package for current gates.
