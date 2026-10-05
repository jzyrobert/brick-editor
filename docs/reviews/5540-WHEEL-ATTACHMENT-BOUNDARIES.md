# 5540 source vehicle ownership — 5 October 2026

Vehicle detection now reviews the actual source attachment graph for the retained
5540 wheel family. It no longer uses a shared MPD ancestor to flatten that graph
into a chassis. Source stud attachments and matching rubber seating form fixed
islands; round bearings, steering pivots, off-axis joining pins, keyed collars
and the existing nine hinges remain articulated ownership boundaries.

A keyed shaft prevents relative spin while its bore overlaps. It does not weld a
bush axially. The new `keyedAxialFreedom` source assembly option therefore keeps
keyed collars independent and omits static accessory travel limits derived from
mobile collars. Existing callers retain the default ideal seated-clutch review.
The previous **39-island** whole-car count used that historical ideal clutch;
it is not the body's native runtime partition. The source-mobile review has
**55 fixed islands**.

This checkpoint integrates source ownership with vehicle detection. It does not
allocate native bodies or admit the complete car to ordinary Play. The current
rigid wheel profile cannot represent the actual graph, so the review retains its
body and boundary diagnostics and leaves all source parts under world
collision/render/inventory ownership. A new native vehicle profile remains work
in progress. Play reports that the axle and hinge assembly is not supported yet.
No budget was raised.

## Actual source evidence

The private whole-model audit uses N. W. Perry's unmodified
[5540-1 OMR source](https://library.ldraw.org/library/omr/5540-1.mpd), under
CC BY 2.0, SHA-256
`2f371753f4df8a60124a099e1af98986024a24102f39446d2401b97d42812715`.
The whole model remains private. The committed
[52-part wheel excerpt](../../fixtures/play/official-cars/5540-wheel-mounts.ldr)
and [117-part carrier graph excerpt](../../fixtures/play/official-cars/5540-carrier-graph.ldr)
retain unchanged source placements and attribution. The latter connects all four
real carriers and nine hinges and also includes the separate cowl and pulley.
Its deliberate omission of cosmetic bodywork, stickers and flexible hoses does
not authorize dropping those occurrences from the complete car.

| Whole-model witness                                     |   Result |
| ------------------------------------------------------- | -------: |
| Original source occurrences                             |      446 |
| Wheel assemblies / real rim-tyre instances              |   4 / 10 |
| Reviewed wheel attachment witness edges                 |       64 |
| Fixed tyre fits                                         |       10 |
| Articulated keyed retainer interfaces                   |       10 |
| Articulated hub/frame bearings                          |       14 |
| Articulated steering pivots                             |        6 |
| Articulated inter-rim pin interfaces                    |       24 |
| Articulated wheel boundaries with source pivot/axis     |       54 |
| Chassis-connected occurrences / fixed islands           | 396 / 55 |
| Whole chassis articulated witness edges / hinges        |   79 / 9 |
| Separately owned removable cowl occurrences             |       31 |
| Separately owned unretained pulley/tyre occurrences     |        2 |
| Separately accounted stickers / authored flexible hoses |   13 / 4 |

Witness edges can describe the same source interface through both connector and
wheel-specific evidence. Their count is not a count of independent native
constraints. The source-native planner must deduplicate physical interfaces and
preserve finite overlap, real head stops and withdrawal.

The carrier excerpt accounts for all 117 occurrences: 84 attached occurrences,
52 fixed islands, 71 articulated witnesses and nine hinges, plus the independent
31-part cowl and two-part pulley/tyre. Nesting every occurrence under one MPD
ancestor leaves those owners separate. Complete source review also accounts for
all 50 unattached occurrences in the private whole car, including its stickers
and authored flexible parents. Exact project content, export and inventory stay
unchanged. Reserved hardware is reported as existing foreign ownership rather
than silently producing an independent partial chassis. Embedded installed-source
dependency shadows are rejected.

## Native geometry cost and remaining admission

An offline canonical geometry audit of all 86 unique source members took
9.68 seconds on this VM. Counts below include unchanged source triangles;
face-compound region counts exclude members refused by the converter's existing
per-member limits.

| Source scope               | Unindexed source vertices | Source triangles | Face-compound regions |
| -------------------------- | ------------------------: | ---------------: | --------------------: |
| Whole 446-occurrence model |                 1,045,128 |          348,376 |                97,637 |
| Attached 396 occurrences   |                   713,598 |          237,866 |                86,765 |
| Actual 32 wheel members    |                   159,864 |           53,288 |                24,436 |

Naive all-active conversion exceeds the existing 600,000 source-vertex,
200,000 moving-triangle and 4,096 convex-child limits. The unchanged 3456 and
3028 sources, and each embedded flexible-hose parent, also exceed the converter's
8,192-triangle / 24,576-vertex per-member limit. These are measured blockers;
source-derived indexed native geometry and appropriate solid packets are needed
before whole-car admission.

The isolated rear-wheel native experiment represents 14 real source parts as 11
bodies and 14 finite cylindrical bearings, with two torque-limited key rows and
mobile bushes. Exact source frames and all source surfaces are retained. Motion
admission remains unresolved: nominal zero-clearance triangulated bore contacts
cause unwanted impulses and loss of the finite bearing gates. Increasing solver
iterations did not resolve this and substantially increased step cost. A narrow
source-certified fit contact policy must preserve exterior surfaces, actual
heads/end stops and foreign collision response. No native motion success or
whole-car driving readiness is claimed by this checkpoint.

Remaining work includes that native contact and loop-closure proof, a source
vehicle profile preserving all fixed islands and hinges, cowl/pulley support and
release, host-bound stickers, two-ended hose deformation and full desktop/phone
source/export/inventory and mechanism-freedom checks.

## Verification

Focused ownership and existing vehicle regression suites cover the actual
wheel stacks, source axes, keyed axial freedom, default API compatibility,
reserved hardware, dependency shadows, nested ancestors, all nine hinges and
exact source/export/inventory preservation. The 12 focused suites pass **84 tests
in 77.37 seconds** on this shared VM. The isolated native motion experiment is
excluded from the ordinary test suite while its contact policy remains unresolved.
