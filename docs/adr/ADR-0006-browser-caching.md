# ADR-0006: IndexedDB binary tile cache

Status: accepted, 2026-09-16.

## Context

Long repeated analyses must not redownload all data.

## Decision

IndexedDB original TIFF bytes and provenance; decoded float32 LRU in worker.

## Alternatives and consequences

Cache Storage is suitable for HTTP responses but structured imported-file metadata fits IndexedDB better. Manual cache clear is explicit; automatic acquisition-version invalidation is unavailable.
