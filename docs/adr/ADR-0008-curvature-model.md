# ADR-0008: Local GRS80 normal section

Status: accepted, 2026-09-16.

## Context

Need reproducible curvature without silently using NHN as ellipsoid height.

## Decision

Directional normal radius with trigonometric effective-sphere formula and parabolic control.

## Alternatives and consequences

Full ECEF plus geoid and vertical deflection is more physically complete but requires verified vertical inputs not present here. This approximation is explicit and remains a release-gate limitation.
