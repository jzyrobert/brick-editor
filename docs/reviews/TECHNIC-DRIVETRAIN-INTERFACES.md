# Source-bound Technic drivetrain interfaces

These helper slices describe actual PF-L motor mounting/output, 3L driving-ring selector interfaces, and the reviewed worm/bevel/differential routing families. It does not yet create a Play rig or claim complete simulation of either set. Runtime integration must separately establish connected fixed carriers, retained shaft bearings, component rendering/collision, power routing and load behaviour.

## Sources and attribution

The minimal regression excerpts derive from Philippe Hurbain's public LDraw OMR models, under their CCAL/CC BY 2.0 terms:

| Model                       | Public original                                                 | Original SHA256                                                    |
| --------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------ |
| 42042-1 Crawler Crane       | [OMR source](https://library.ldraw.org/library/omr/42042-1.mpd) | `d9c3aa6e0351fd7bcc352e817dafd2c095d4192d7f691ddbb7c5eece03d7237b` |
| 42043-1 Mercedes-Benz Arocs | [OMR source](https://library.ldraw.org/library/omr/42043-1.mpd) | `6264ccf8fd18d666b68c4538eb69ddfbd87fe5bf633ebf34395b48229e9fc369` |

The excerpts in [fixtures/ldraw/technic](../../fixtures/ldraw/technic/README.md) compose actual nested placements into world coordinates, identify original lines and use a uniform test colour. They preserve the original geometry/transforms; they are not complete model fixtures. Full originals and downloaded official instruction PDFs stay in private maintainer research. Operational references are the official [42042 instructions](https://www.lego.com/en-us/service/building-instructions/42042), pages 234–235 of booklet 6151636, and [42043 instructions](https://www.lego.com/en-us/service/building-instructions/42043), pages 472–477 of booklet 6182511.

Official part geometry remains in the pinned LDraw library, with its original author/license headers. Source profiles bind complete dependency closures, not a basename or bounding box. `bindDrivetrainSources` hashes each dependency's literal text and the sorted `[reference, SHA256]` list. The 99499 closure contains 76 files and hashes to `649bafecc8a0d7104c7731e2e04a59ef06f833aaa91f9b176d9a673bda33d679`. Product callers also pass the authoritative project to the shared `verifyReviewedSourceClosures` verifier: project-defined source IDs/names shadowing any dependency refuse, even if an independently loaded clean library closure would hash correctly. Other root/closure hashes live in [drivetrain-sources.ts](../../src/mechanisms/drivetrain-sources.ts). Changed or missing dependencies, project-namespace lookalikes and fabricated interface tokens refuse. Hash identity alone does not establish mating, carrier ownership or a transmission.

## Motor geometry and ownership

99499 contains separate source branches: `10089c01.dat` for the casing and `10095.dat` for the rotating hub. The interface exposes component IDs `case` and `output` with those source paths. It never rotates the whole casing to align an axle. The independently compiled hub has a keyed channel at local Z 0..20 and a closed cap beginning at Z22.

The 10090 front has pin mouths at `(±20,0,0)` and `(0,±20,0)`, facing +Z with span 0..20. Its source cylindrical cores have radius 6 over Z2..18. Side mouths are at X±30, Y±20, Z10/130, facing inward. `pfLargeMotorContacts` requires at least two distinct, unambiguous seated pins and a coaxial keyed axle inserted 7.5..20 LDU; it refuses floating/off-axis mounts and closed-back crossing. Alignment/seating recognition uses at most .05 LDU and axis dot .99999, within the source hole clearance; this is a connection recognition rule, not a world-contact exemption.

The crane's actual 48989 support supplies two integrated front pins, and its 3705 axle has 20 LDU output engagement. The Arocs has four actual 2780 pins (front and rear side seats) and a 3707 axle with 20 LDU engagement. Their inserted axle phases relative to the default drawn hub are approximately 8° and 15.0089°. The witness returns `rotorRestPhaseDegrees`; runtime must retain this internal rest phase explicitly while leaving authored case/brick placements unchanged. It does not by itself prove those support parts belong to a connected carrier island.

## Selector geometry and conditional relations

18947 slides on the ridged 18948 coupler. Its literal end tips are at Z±28; 18946 gears have span ±10 and pocket shoulders at Z±2. The two actual gear centres must be on opposite ends of the same shaft at distance 40±.5 LDU. Stops derive from their actual centres: `[negativeCentre+30, positiveCentre-30]`. They are ±10 LDU in the crane excerpt and ±9.5 LDU in the Arocs excerpt; authored .5-LDU origin differences are retained. Positive shoulder overshoot refuses, including .001 LDU.

Neutral leaves both gears free. Partial insertion yields no ring-to-gear constraint. At a seated end and a reviewed indexed dog phase, the helper supplies a signed 1:1 `dog-clutch` relation. The `keyed-slide` relation to the coupler is distinct. `blocked-phase` means this indexed relation is not admitted at that phase; it is not a general collision solver or a proof that every other angle cannot fit. No automatic gear snapping, selector force, friction, synchronisation or shifting under load is implemented here.

The admitted .5° neighbourhood of quarter-turn alignment is supported by literal footprints. Every engaged-end ring dog polygon, clipped at Z20, stays in one diagonal quadrant with transverse coordinates above 7.125 LDU and radius below 13.584 LDU. All 56 literal gear-dog polygons stay in axis strips of transverse width ±1.5 LDU and longitudinal coordinate at least 13.218 LDU. The ring sleeve radius is 11.875; the gear's 48-sided pocket core has inradius `14.7171*cos(pi/48)`. These finite convex polygon bounds retain separation throughout the admitted phase interval. Independent compiled source rays confirm diagonal pocket voids, axis dog material and the ±2 pocket shoulders. A 45° rotated indexed candidate yields no coupling.

## Worm, bevel and differential routing

[drivetrain-routing.ts](../../src/mechanisms/drivetrain-routing.ts) supplies ideal angular increment constraints from separately bound source members. It does not grant power, invent a hand input, weld support islands or exempt tooth contacts. A caller must prove independently retained carriers/shafts before applying them. All angular increments are relative to the authored source rest frames; recognition does not snap or rephase source gears.

The two actual crane winches have 4716 worms and 10928 eight-tooth gears on orthogonal skew axes, separated by 20 LDU, with the gear station at ±10 along the worm. The source `s/4716s01.dat` crest advances Z2 during a positive quarter-turn, and `s/4716s02.dat` repeats that helix every 8 LDU: a positive-handed single start. Combining its hand with the actual wheel contact tangent gives +1:8 about each source part's signed local axis, including the mirrored winch. The helper only recognizes this pair and active seat. It does not assert self-locking: that requires friction/load evidence.

The Arocs' reviewed orthogonal pairs are 32270 twelve-tooth double-bevel with 6589 twelve-tooth bevel, and 87407 twenty-tooth bevel with 6589. Their signed centre-to-axis-intersection stations are respectively `[±20,+17]` and `[-20,+27]`; the 6589 differential side/spider pairs use `[+17,+17]`. These offsets include the actual source tooth-face origins. They cannot be replaced by a generic cylinder or an arbitrary pitch-radius/AABB proximity rule. The helper requires the specific family, orthogonal true axes, signed stations within .05 LDU, and axis-intersection gap at most .05 LDU. The literal composed Arocs rotating joint leaves one gap .02613 LDU; the helper retains it. Common pitch tangents establish direction, while literal tooth counts establish 1:1 or 20:12 magnitude. Reversing endpoint order returns the reciprocal ratio; applying a whole-model rigid rotation preserves it. These are ideal source-seating equations, not a finite all-angle tooth collision or clearance certificate; native tooth/contact and load verification remains required.

Both actual 62821 differential carriers contain two 6589 side gears at local Z±17 and a third 6589 spider at `(0,-17,0)` facing +Y. The case's literal `4-4cylc.dat` has radius3 and spans Y−20..−10. The spider's keyed core spans its local Z0..7; an independent compiled source ray measures diagonal core clearance `sqrt(12.5)>3`. Side axle/bearing retention is a separate assembly obligation. The helper matches all three distinct seats and returns the signed equation `sideA - sideB - 2*carrier = 0` for these source-axis directions, plus the independently spinning spider relation in the carrier frame. Equal wheel speeds, differing wheel speeds, and a stopped side are tested. The case and internal gears are never merged into one rigid occurrence or assumed fixed merely because they share an OMR submodel.

The additional attributed routing excerpts preserve both real winches, the four Arocs exterior bevel pairs, and both differentials. They deliberately omit chassis/support parts, so they establish interface/routing regressions rather than complete functional mechanisms. Other orthogonal gear family pairings, arbitrary operating phases, sliding/retention changes, gear elasticity, selector shifting under load and physical friction remain unsupported until their own source and runtime checks are added.

## Verification and limits

Run the portable source tests against installed pinned packs, with no network:

```sh
npx vitest run tests/unit/drivetrain-interfaces.test.ts tests/unit/drivetrain-routing.test.ts --maxWorkers=1
npx tsc -b
npx prettier --check src/mechanisms/drivetrain-interfaces.ts src/mechanisms/drivetrain-sources.ts src/mechanisms/drivetrain-routing.ts src/mechanisms/reviewed-source-closure.ts tests/unit/drivetrain-interfaces.test.ts tests/unit/drivetrain-routing.test.ts fixtures/ldraw/technic/README.md docs/reviews/TECHNIC-DRIVETRAIN-INTERFACES.md
```

The tests bind full source closures; reject altered hub subparts, namespace spoofing, invalid interface witnesses and mount/insertion errors; verify source pin/hub surfaces; distinguish neutral, partial, unsupported phase, seated engagement and strict shoulder stops in both attributed excerpts; and confirm unchanged source documents. This establishes a bounded source interface/ideal relation component. Complete model assemblies and runtime application of the conditional equations, closed-link mechanisms, cables/tracks/pneumatics, native collision/load acceptance, renderer internal-part partition and phone budgets remain independent obligations of the full-system work.
