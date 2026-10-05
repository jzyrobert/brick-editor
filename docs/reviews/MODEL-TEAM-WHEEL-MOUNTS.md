# Reviewed Model Team wheel mounts

The new wheel review recognizes actual round bearings and retained wheel
stacks in the public LDraw OMR model of Formula 1 Racer 5540. It provides typed
attachment witnesses and preserves every tyre and joining pin. This review
does not establish complete ownership or driving of the full set, simulate its
steering rack, or replace the separate source assembly review.

## Source and geometry

The original is N. W. Perry's `[Plastikean]` CCAL 2.0 model,
<https://library.ldraw.org/library/omr/5540-1.mpd>, SHA-256
`2f371753f4df8a60124a099e1af98986024a24102f39446d2401b97d42812715`.
The full original stays in gitignored `.local`. The attributed
`fixtures/play/official-cars/5540-wheel-mounts.ldr` contains 52 selected actual
occurrences with flattened source transforms. It deliberately omits the
connecting chassis and is refused as a standalone vehicle.

The pinned official library supplies these interfaces, with literal hashes in
`REVIEWED_AXLE_WHEEL_SOURCES`; library headers and packs are unchanged:

| Parts              | Reviewed interface                                                                                                                                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2695 / 2696        | Same-origin stepped rim and asymmetrically seated tyre. The rim has a round R6 central bore, not a keyed axle socket. Complete compiled tyre vertices reach radius 54.004008581 LDU; the controller envelope is 54.005 LDU.       |
| 3706 / 3707        | Real 6L / 8L axle spanning the full rim bore and frame bearing, retaining the source tip bevel.                                                                                                                                   |
| 3713               | Two actual keyed retainers capture the axle on both sides of the bearing; an outer retainer and the inner bearing face capture the complete wheel stack.                                                                          |
| 3700               | Rear round bearing at local `[0,10,0]`, along local Z.                                                                                                                                                                            |
| 4261 / 4262 / 4263 | Front arm's transverse round bearing, and actual upper/lower sockets capturing both vertical pivot pins. The primary carrier is the stud-connected lower plate.                                                                   |
| 3749               | Two opposed off-axis joining pins connect each pair of rims spaced 32 LDU apart. Round stem and keyed stub orientation are distinct. Optional actual arm-to-rack linkage is reported only when the pin and 4263 socket also seat. |

Full 5540 has ten physical tyres but four controller wheel assemblies: two
front tyres on each side and three rear tyres on each side. The front station
is Z−200, rear Z230, with tyre centres Y−54. The rotational groups preserve 32
source occurrences: twenty rims/tyres plus twelve real joining pins. The two
steering linkage pins are separate attachment witnesses, never an invented
steering rack. A round-bearing or retained-pivot edge establishes attachment
and preserves its freedom; callers must not treat all reached members as a
rigid chassis weld.

The existing vehicle controller has one support/suspension ray per rotating
group, centred across a coaxial stack. Separate source tyres remain in the
collision/render geometry and attachment evidence, but this is a flat-support
vehicle approximation, not independent twin-tyre suspension or a simulation of
every tyre contact patch.

## Admission and limits

`reviewedAxleWheelMounts` requires official namespace, the pinned full/curated
library manifests, proper nearly-physical authored transforms and complete
source bounds. Missing or ambiguous tyres, shafts, retainers, pivot sockets,
joining pins, reversed asymmetric tyre seating and incompatible rim-hole
orientation refuse the affected assembly. A work-budget failure discards all
partially reviewed assemblies and edges. Its caps remain 256 wheel parts,
128 holders and 100,000 connection checks; callers may lower them, never raise
them.

Automatic vehicle layouts count the actual controller assemblies and groups
rather than assuming four wheels. They require two or more axle stations,
symmetric supported sides, parallel horizontal axles, a common centreline and
non-overlapping adjacent wheel envelopes. Each physical tyre's source centre
plus reviewed radius must share the support plane within 0.01 LDU, covering
the explicit source radius margin rather than suspension. Different radii can
therefore be admitted only with matching source heights. Actual groups,
members, candidate graph, rig and driving-domain limits still apply. Arbitrary
tilted or suspended arrangements are not flattened into a level rigid chassis.

The existing 4600, 2441 and 6157 pin-holder families retain their source fits.
The new mount graph adds only witnessed bearing/retainer/pivot edges among
actual chassis candidates; source proximity is not a weld. Full-set cowl,
seat, decorative and flexible-part ownership remains a separate gate.

42043 uses twelve 86652/32019 wheels, four axle stations, rear twins, real
steering/suspension linkages and a 0.56 LDU front/rear centre-height difference.
Those families and articulation require their own source review; this helper
does not certify that vehicle or its mechanical systems.

## Verification

`tests/unit/play-reviewed-wheel-mounts.test.ts` checks the real isolated stacks,
source hashes and compiled radial support, translated yaw at 37°, 90° and
180°, optional steering-link socket evidence, missing/ambiguous parts and
work-budget refusal. The full source, rest transforms and inventory remain
unchanged. A separate original arrangement of four stud-connected axle
stations checks nine actual groups and the group cap. Kinematic driving and
native default-ground driving/reversal preserve all eight wheel contacts and
source/inventory. It does not stand in for full 5540 acceptance.

Run:

```sh
npx vitest run tests/unit/play-reviewed-wheel-mounts.test.ts tests/unit/play-auto-vehicles.test.ts --maxWorkers=1
npx tsc -b
```
