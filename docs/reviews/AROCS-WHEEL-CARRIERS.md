# Source-bound Arocs wheel carrier interfaces

This slice exposes actual wheel, shaft, round carrier and passive coupling
interfaces from the public OMR model of 42043. It is attachment evidence for
the assembly solver, not admission of a complete drivable truck. Suspension,
two front steering stations, differential load response and full chassis
ownership still require their own runtime realization and verification.

## Provenance

Philippe Hurbain's `[Philo]` CCAL 2.0 original is
<https://library.ldraw.org/library/omr/42043-1.mpd>, SHA-256
`6264ccf8fd18d666b68c4538eb69ddfbd87fe5bf633ebf34395b48229e9fc369`.
It stays in gitignored `.local`. The attributed
`fixtures/play/official-cars/42043-wheel-carriers.ldr` preserves 56 selected
actual occurrences, flattened without changing positions, bases, colours or
part references. It omits the connecting suspension and chassis.

`arocs-wheel-sources.json` binds each reviewed official root and its complete
dependency closure. Reproduce it from the pinned local library with:

```sh
npx tsx scripts/build-arocs-wheel-sources.ts --check
```

The shared source verifier also refuses project models shadowing any root or
dependency. Interface objects and binding tokens are sealed by identity; a
project part borrowing an official filename or a manually copied token does
not qualify. The part profiles require proper nearly-physical source frames.
No source geometry or pinned library headers are rewritten.

## Actual architecture

| Source family          | Reviewed interface                                                                                                                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 86652                  | Keyed short hub, local Z−10..10, using J. C. Tchang's CC BY 4.0 `axl3hole` primitive. This differs from the round-bore 2695 rim.                                                                                        |
| 32019                  | Same-origin asymmetrically seated tyre; axial extent Z−34.5..15.5, source centre offset −9.5. Complete compiled radial maximum is 78.297996521 LDU; the reviewed envelope is 78.299.                                    |
| 87083 / 32123a / 48989 | Front stopped 4L axle, two actual half-bush collars capturing the hub, and the real cross-block's round bearing. The carrier bearing remains rotational.                                                                |
| 59426 / 32184          | Rear stopped 5.5L axle and central round carrier bore. The axle's short keyed stub, round transition, shoulder and long keyed arm remain distinct.                                                                      |
| 59443 / 4519           | Actual rear passive coupling and separate 3L axle. The two keyed bores remain separated by the literal closed Z−0.25..0.25 partition. Actual end bevels and complete material extents prevent a shaft-crossing witness. |

The selected source contains twelve physical tyres on eight stopped-shaft
rotating units: four single front wheels and four rear twin units. Four axle
stations remain at source Z−242.4, 17.6, 500 and 700. No inter-rim pins are
invented: the rear hubs share an actual keyed axle. The four rear coupling
witnesses retain 15.5 LDU of keyed engagement on the stopped shaft and 17.5 LDU
on the separate 3L axle. The R8 shoulder seats between the source carrier mouth
and coupler end; it is not a motor or a rigid carrier weld.

`arocsWheelUnits` reports these freedoms explicitly. A keyed hub locks shaft
rotation; a round carrier permits bearing rotation. Axial capture is recorded
separately as two collars, source stop/coupler, or unproved. These are source
interface witnesses, not a claim that frictional grip, steering, suspension or
native contact/load behavior has been simulated. Every unit is marked
`attachmentOnly`.

## Authored fit discrepancy and support

Front wheel centres have source Y−80.56; rear centres have Y−80. Their 0.56 LDU
difference is retained and cannot pass a fabricated common-plane suspension
shortcut. The second front axle's source placement is also explicit:

- Top-level rim at `[-150,-80.56,17.6]` (original line 314).
- Its shaft at `[150,-19.403,-2.389]` in the second-axle submodel (line 1396),
  under the exact signed-permutation parent `[0,-100,20]` (line 165).
- Actual world shaft centre `[-150,-80.597,17.611]`.

The transverse discrepancy is 0.038600518 LDU. The closest compatible wheel
translation is `[0,-0.037,+0.011]`; the helper reports this correction without
applying it. It is not caused by Float32 or frame orthonormalization, and
rounding the displayed two/three decimal coordinates alone does not account
for the whole discrepancy.

An independent compiled ray check finds the hub wall at local X−6. The
translated nominal opposite shaft tip would be X−6.037. Axle and hub surfaces
also have intentional keyed contact at nominal extrema; this evidence is not
a free-clearance certificate or proof that the full real assembly is invalid.
The 0.05 LDU candidate search only associates source interfaces and reports the
residual. It grants no collision exemption, source shift or runtime admission.
An accepted ideal assembly frame or bounded source-fit reconciliation must be
reviewed explicitly and retain contact/load tests.

## Checks

Focused tests preserve all source, rest and inventory data, verify the full
closure and shadow refusals, retain all eight units/twelve tyres/four passive
rear couplings, and replay translated yaw at 37°, 90° and 180°. Missing collars
or couplers remain unproved. Separated tyres, larger transverse mismatch,
fabricated interface tokens and a real closed-partition crossing refuse their
witnesses. Canonical geometry checks cover the keyed wall and tyre support.
Enumeration stays within 256 sealed source interfaces and 100,000 checks.

```sh
npx vitest run tests/unit/play-arocs-wheel-interfaces.test.ts --maxWorkers=1
npx tsc -b
```
