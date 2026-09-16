# ADR-0009: Separate terrestrial and solar refraction

Status: accepted, 2026-09-16.

## Context

Terrain rays and incoming solar rays require different approximations.

## Decision

Effective-radius terrestrial k; per-limb NOAA solar refraction with P/T scaling.

## Alternatives and consequences

Applying one coefficient to both problems or translating a rigid solar disk hides distinct physical assumptions. Sensitivities remain scenarios rather than confidence bounds.
