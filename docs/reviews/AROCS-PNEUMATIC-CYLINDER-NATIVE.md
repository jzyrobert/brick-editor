# Arocs pneumatic cylinder: bounded source-native checkpoint

This package constructs the actual 2015 Arocs 2 × 11 cylinder body/cap and
separate eye/rod as two native actors, then applies the existing pneumatic
kernel's equal and opposite pressure impulses. It does not set live actor
position or velocity. This is a component bench and runtime handoff, not
ordinary admission of a complete Arocs, its mounts, or its four-cylinder circuit.

## Source identity and ownership

The minimal fixture retains the two literal local placements from Philippe
Hurbain [Philo]'s public
[42043-1 OMR source](https://library.ldraw.org/library/omr/42043-1.mpd).
The original model SHA256 is
`6264ccf8fd18d666b68c4538eb69ddfbd87fe5bf633ebf34395b48229e9fc369`.
The original hash is also retained in the fixture. Embedded part headers and their
CCAL 2.0 attribution remain intact; this excerpt is attributed under the same
CCAL 2.0 terms. Official primitive dependencies remain in the pinned library.

`sourceHardwareIndex` identifies the real embedded parent placements, rather
than treating every rendered primitive as a cylinder or welding its neighbors.
The profile separately verifies the complete resolved literal closures and the
actual canonical compiled surfaces:

| Source parent          | Closure files | Canonical vertices | Source triangles |
| ---------------------- | ------------: | -----------------: | ---------------: |
| `42043 - 19466c01.dat` |            58 |              5,517 |            1,839 |
| `42043 - 19467c01.dat` |            14 |              1,272 |              424 |

A private prepared token binds the exact project, revision, member IDs, matching
source frames and cloned canonical buffers. Altered embedded dependencies,
altered surfaces, copied tokens, stale placements and duplicate native owners
refuse. The native construction uses two bodies, three colliders and one
prismatic constraint. Construction checks the existing 64-body domain and a
512-collider class bound before adding actors. The 2,263 canonical triangles are
below the profile's 8,192-triangle budget; this does not waive global source or
moving-geometry admission when ordinary integration is added.

## Visible geometry and explicit ideal internals

The body collider retains its complete source triangle surface, including the
barrel, cap, ports and mount hole. The rod eye retains its triangle surface and
open pin hole. Strictly participating shaft triangles provide the exact solid
shaft hull; coplanar wide eye faces cannot enter that hull. Native ray checks
pass through both actual pin bores and hit their neighboring material rims.
There is no fabricated pin, chassis mount or nearby-part attachment.

The source has an inner barrel radius of 15 LDU over Y −28 to −176, a cap bore
radius of 6 over Y −178 to −176, and a radius-6 rod shaft over rod-local Y 19 to 169. All retain their actual 16-facet source cross-sections. The source does not
render the hidden pneumatic sealing piston. Its effective seal, pressure areas
and lubricated axial guide are explicitly ideal simulation assumptions. The
base area uses the source faceted radius-15 polygon; the cap area subtracts the
source faceted radius-6 shaft area. These are gameplay-scale simulation areas,
not measured LEGO force, pressure, leakage or friction ratings.

The retained simulation domain is an eye separation of 200–330 LDU. It keeps
the shaft tip inside the source chamber at Y −31 through −161. Native stops
reserve a further half LDU at either end (200.5–329.5); eight additional solver
iterations retain the unchanged pneumatic kernel's 1 mm alignment/travel
refusal. This deliberately conservative range does not assert the actual
manufacturer's full stroke or claim that the omitted sealing piston is visible
CAD stop geometry. Primary
[LEGO pneumatics documentation](https://www.lego.com/en-us/service/help-topics/article/pneumatics)
confirms the real air circuit; the targeted source/specification search did not
establish a manufacturer numeric stroke for this embedded V2 profile.

Native rigid frames normalize the original rounded proper bases. The original
serialized frames remain unchanged; native rigid interpretation is distinct
from literal affine expansion of their rounded columns. The sample's original
radial fit residual is below the narrowly declared 0.002 LDU source-fit bound.
Simulation masses (1 kg per mobile actor by default) and positive inertias are
explicit approximations rather than measured part weights.

## Contact and pressure handoff

Rigid zero-clearance shaft/cap contact initially produced an unusable axial
response in the pinned engine: positive pressure eventually returned the rod to its lower
stop. Only the exact shaft/body collider pair can use the ideal lubricated guide
allowance. The complete native shaft support is transformed into the body frame
at the current and velocity/angular-velocity-predicted next tick. Every actual
support point and every point-pair intersection with each guide-slab boundary is
checked against the actual cap/chamber facet planes. Point pairs include every
true convex-hull edge, so a tilted shaft cannot pass on centerline checks alone.

The cap alone has the declared 0.002 LDU fit allowance. The wider barrel has no
added radial allowance. Axial retention must also hold. Prediction outside that
envelope restores ordinary contact; the eye, body exterior against other
classes, and every foreign collider remain responding. Native queries run with
an owned event queue so the pinned Rapier contact callback actually executes.
Disposal frees that queue and removes only this package's own actors.

`createSourcePneumaticCylinderCircuit` connects the native actor to the exact
sealed routing topology. It requires the body's real cylinder owner and exactly
one actual opposing valve route, preserving inverse base/cap plumbing. A copied
routing observation refuses. Source edits or released native actors refuse
before another circuit step changes gas or submits impulses.

The bench declares its initially charged supply once. Repeated strokes consume
that finite gas; there is no command that refreshes pressure. Full ordinary
operation still requires an actual source pump body/rod and its native guide,
real valve/lever ownership, mounting connections, full actor ownership and
session admission. Unmodeled cylinders and the pump are not certified by the
one-actuator circuit handoff.

## Reproducible checks

```sh
npx tsx scripts/audit-pneumatic-cylinder-source.ts
npx vitest run tests/unit/play-pneumatic-cylinder-native.test.ts --maxWorkers=1
npx tsc -b
```

The offline maintainer audit checks the closure and renderer-surface manifest;
`--write` rebuilds only that generated manifest after source review. It performs
no downloads and changes no library file.

Seven focused cases passed in 5.84 seconds on the shared VM after the final
attribution-only fixture update (the previous run passed in 8.80 seconds): actual retained
travel/reversal/stops; foreign obstruction and retry; mobile pressure reaction
and momentum; surface/closure/stale/copy refusal; sealed actual valve routing
and atomic source-change refusal; open pin bores/solid rims; predicted complete
shaft-envelope contact restoration and removed-body refusal; and budget
refusal before allocation (some cases cover multiple related assertions).
The manifest audit, TypeScript, scoped formatting and diff checks passed.
These are software correctness measurements, not phone frame-rate evidence.
