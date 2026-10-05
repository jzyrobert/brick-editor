# Source-bound Arocs pneumatic routing

This unpublished systems-branch checkpoint binds the actual pneumatic routing
of Philippe Hurbain (Philo)'s CCAL2.0 OMR42043-1. It establishes gas connectivity,
not native admission of the complete model or its cylinders.

The attributed `fixtures/play/mechanical-systems/42043-pneumatic-routing.mpd`
excerpt preserves all28 authored hose subfiles, including every fallback skin
and both literal end references. It includes the25 actual port-bearing hardware
placements and the complete36-file embedded definition closure. Their world
placements are flattened from the original hierarchy; original colours are
retained. The chassis, cylinder rods and attachment hardware are outside this
excerpt, so it makes no claim that these bodies are supported or guided.

Source: [42043-1 OMR model](https://library.ldraw.org/library/omr/42043-1.mpd).
Complete-model SHA256:
`6264ccf8fd18d666b68c4538eb69ddfbd87fe5bf633ebf34395b48229e9fc369`.
LDraw headers of copied definitions remain intact. Official part geometry stays
in the pinned pack. Only the public LDCad metadata format is parsed.

The manifest is reproduced offline by
`npx tsx scripts/build-pneumatic-sources.ts` (`--check` verifies it). Each profile
binds its complete resolved literal dependency closure, including BFC and
reference transforms. Container FILE/NOFILE records, blank lines and surrounding
line whitespace are normalized. Source names alone cannot authorize a profile.
The explicitly reviewed2015 embedded cylinder, valve and pump definitions take
precedence exactly as in the renderer; substituted modern versions or altered
embedded dependencies fail their hashes. Project/model identity, revision and
source records/placements seal the subsequent routing result.

## Actual interfaces and tube fit

The reviewed hose end165 resolves to71533k01. Its literal inner R4 bore spans
localY2..20. The99021 joiner and4697b T-piece have source R4 barbs and open
internal passages. The two cylinder chambers and three valve ports remain
distinct; sharing a casing never merges their gas nodes. The stepped pump and
valve roots retain their original narrow tip geometry and R4 fitting shafts.
The generated manifest retains every local base/tip/role datum for review.

Each source cap must resolve to exactly one fallback occurrence. Its inward
axis must oppose the actual barb axis (dot<=−0.9999), its tip must lie at cap
localY2..12, and the overlapping fitting span must be8..18LDU. A0.15LDU radial
elastic allowance represents a seal of this flexible rubber end; it is a
declared simulation assumption, not a rigid-joint tolerance or measured pressure
rating. No nearest-part fallback is used. Ambiguous fittings, duplicate use of a
port, missing caps and open ports refuse the complete result atomically.

The original end frames contain up to0.002511 column-length and0.001756
normalized cross-column dot residual from accumulated rounded placements. The
flexible-end frame check permits0.003 and0.002 respectively, requires a positive
determinant, and normalizes only its fitting direction. It preserves the exact
source placement. Rigid hardware retains its existing proper-frame check.

The routing output has56 separate ports,28 hoses and47 passive passages:
28 hose connections,13 joiner bores and six T-piece branches. The pump supply
component contains16 nodes and reaches all four valve supply ports; none of
their work ports is permanently joined to supply. Each valve's two work routes
reach exactly one cylinder's opposing chambers. The inverse cap/base plumbing
is preserved; workA does not universally mean rod extension. Valve position
must route pressure through these separate nodes at runtime.

## Verification and remaining integration

Four focused source tests verify complete routing, independent work lines,
original source/export preservation, immutable observations, altered dependency
and shadow refusal, stale/unseated placement refusal, ambiguous duplicates and
incomplete ends. They run with the pinned local library and no network.

The separate `NativePneumaticCircuit` supplies gas accounting, real chamber
compression, closed-center valves and equal/opposite cylinder impulses. This
routing packet does not itself authorize body/rod guides, travel stops, native
collision profiles, mounting joints, deforming hose geometry, controls or
whole-model Play entry. Those source and runtime obligations remain open.
