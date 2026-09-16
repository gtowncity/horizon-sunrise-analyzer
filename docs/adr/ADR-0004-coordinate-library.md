# ADR-0004: proj4 and GeographicLib

Status: accepted, 2026-09-16.

## Context

Raster sampling and geodesic bearings have different requirements.

## Decision

proj4 for UTM32 projection; GeographicLib for geodesic distances and paths.

## Alternatives and consequences

A spherical great-circle shortcut is simpler but is avoidable here. No unverified vertical conversion is performed.
