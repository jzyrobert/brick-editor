# Arocs suspension and steering ball interfaces

This source-bound interface checkpoint identifies the actual suspension arms and steering links in OMR42043. It does not admit the complete model as a working vehicle or infer a powered steering/suspension control. Wheel interfaces are reviewed separately in [AROCS-WHEEL-CARRIERS.md](AROCS-WHEEL-CARRIERS.md).

The minimal38-occurrence fixture `fixtures/play/official-cars/42043-ball-link-interfaces.ldr` preserves all selected authored transforms from Philippe Hurbain's CCAL2.0 [42043-1 OMR model](https://library.ldraw.org/library/omr/42043-1.mpd), SHA256 `6264ccf8fd18d666b68c4538eb69ddfbd87fe5bf633ebf34395b48229e9fc369`. It contains every6628/2736 ball,15459 arm and32005/32293 link from that source. Library geometry stays in the pinned pack with its original CC BY headers. The excerpt simplifies colours to16 and retains file/line ancestry; no geometry or placement changes.

## Literal interfaces

| Part                      | Actual part-local interface                                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6628 friction-pin towball | Sphere radius8 at X−10; attached neck radius4.                                                                                                     |
| 2736 keyed-axle towball   | Sphere radius8 at X−12, not X−10. The shaft and neck remain separate from the ball centre.                                                         |
| 15459 suspension arm      | Socket centre Z−80: the root positions `s/57515s01` at Z−60, which positions `s/57515s02` at Z−20. Round pivot hole Z−60 is not the socket centre. |
| 32005 6L steering link    | Two sockets at Z0 and100. Core cylindrical radius8 and snap-retention tabs at Y2.5/3.5/4.5, inner tab radius7.27.                                  |
| 32293 9L steering link    | Two sockets at Z0 and160. Core radius8 and elastic retention tabs at Y2.25/3.25/4.25.                                                              |

Source closure hashes include the socket tabs, spherical primitives and every transitive dependency. `bindArocsArticulationSources` refuses modified or missing dependencies, project shadows and fabricated tokens. Interfaces retain both literal authored centres and centres derived using the existing bounded rounded-rotation normalization. Neither representation changes the project.

## Rest fit and material evidence

All18 actual sockets have one nearby source ball within the diagnostic3LDU search. That search grants no attachment: only endpoints coincident within1e−7LDU in both literal and normalized rigid coordinates produce articulated witnesses. Every mismatch is reported with its actual distance and diagnostic ideal translation. No mismatched socket generates a joint or rigid weld.

Four rear15459 sockets differ from their6628 ball centres by1.849107893LDU in the authored source, and1.866648021LDU under rigid normalization. Independent compiled-source BVH tests find95 proper transverse triangle crossings per pair at authored rest. A diagnostic translation of each socket to its ball centre eliminates these crossings; it is not applied to source or runtime poses. Front arm endpoint residuals are about0.0386LDU. One literal-coincident front arm acquires a0.00204LDU discrepancy under rotation normalization.

Steering link endpoint residuals include2.058526172LDU at the first-front far endpoint and1.941648784/1.980380771LDU at two rear link endpoints. The32005/32293 compiled surfaces also cross at coincident centres: these are modeled snap-tab/neck material contacts. They must not be described as an empty rigid bearing clearance or resolved by suppressing entire parts.

`arocsBallJoint` constructs source-coincident spherical anchors only for sealed fits and actual endpoint-owning bodies whose serialized rest frames match. It supplies no motor, guessed angular limits or collision allowance. This is a constraint specification, not proof of a usable angular range. A complete implementation still needs source-neck/lip articulation bounds, local ideal-elastic retention contact treatment, collision-safe body ownership and an explicit rest-closure/settling operation for the authored mismatches. Independent whole-model source ownership and suspension/shock force parameters remain separate work. The arms and bogies must remain articulated rather than be welded to fixed wheel stations.

## Full-model collision cost

A private read-only renderer compile of the full source counted2752 official atomic hardware occurrences across168 distinct official refs:4,095,233 canonical triangles before31 embedded hardware/caps. The447 occurrences of2780 contribute672,288 triangles;233 of6558 contribute499,552. This already exceeds the200,000 Play geometry cap by20.5 times. It is not an admission or frame-rate measurement. Semantic source-reviewed collision proxies and complete physical ownership are required; splitting rigs alone does not bypass the global512-member limit. Flexible fallback skin primitives are not independent hardware members.

## Verification

Run `npx tsx scripts/build-arocs-articulation-sources.ts --check` and `npx vitest run tests/unit/play-arocs-articulation-interfaces.test.ts tests/unit/play-arocs-wheel-interfaces.test.ts --maxWorkers=1`. The13 checks cover closure/shadow/token refusal, exact source endpoint ancestry, rear material intersections, explicit misalignment refusal, spherical anchor construction, missing/ambiguous balls, bounded work,37°/90°/180° yaw and source/export/inventory preservation. Native full-system motion, finite socket articulation, shock constants and whole42043 Play admission are not claimed by this checkpoint.
