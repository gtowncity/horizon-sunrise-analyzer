# ADR-0003: Official ZIP workflow

Status: accepted, 2026-09-16.

## Context

Direct TIFF ranges work server-side but fail cross-origin in the browser; elevation REST POST preflight also failed.

## Decision

Use the official poly2metalink ZIP service, validating returned URL hosts and TIFF metadata.

## Alternatives and consequences

A proxy would add hosting and security obligations. The official archive route passed real browser tests. Local file import is the fallback; no imaginary data.
