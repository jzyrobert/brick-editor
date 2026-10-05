# Efficient physics for the remaining Technic systems — 5 October 2026

**Question from the owner:** could a driven vehicle be modelled as a much
smaller number of objects?

**Answer: yes.** The whole 5540 source car (446 occurrences, 396 attached,
55 fixed islands, 79 articulated boundaries, 237,866 attached triangles) drives,
steers, reverses and stops at a wall as **one rigid body with one compound
collider and four wheel rays**. One native body per fixed island needs **55
bodies, 396 colliders and at least 67 joints**. On this VM the compact chassis
steps in **0.15–1.7 ms**, against **10.8 ms** for island bodies with convex
hulls and **661 ms** for island bodies with source triangle meshes. It has
**no internal contact pairs**, so the false deep contacts the TODO describes
cannot occur inside it. Both island versions blow apart within a second (peak
speeds near 17,000 LDU/s) even with every boundary held by a fixed joint.

**Update, Phase 1 (same day): the 5540 now drives in ordinary Play this way.**
The owner made two choices:

- The rest of the car is one body for efficiency, but steering and hinges are
  animated.
- The loose parts ride along, after the owner saw [which parts are not
  attached](#which-parts-are-not-attached).

The [Phase 1 section](#phase-1-one-body-source-cars-in-ordinary-play) describes
what moves, what is drawn, what rides along and the Chromium measurements. The
measurements below are the original exploration.

The physics code is `src/play/compact-vehicle.ts`:

- hull merging, member mass and the clearance check;
- `compactArticulatedSource`, the chassis compound used by Play;
- the experimental `CompactRaycastVehicle` used by the benchmark.

Ordinary Play uses `source-vehicle-articulation.ts` (the drawing plan) and
`source-vehicle-ride-along.ts` (the loose-part evidence). The benchmark is
`scripts/compact-vehicle-bench.ts` with `tests/helpers/compact-vehicle-bench.ts`.
The tests are:

- `tests/unit/play-compact-vehicle.test.ts`
- `tests/unit/play-source-vehicle-articulation.test.ts`
- `tests/unit/play-systems-sketch.test.ts`
- `tests/browser/play-source-vehicle.spec.ts`

## Which parts are not attached

The owner asked for a picture of what is not attached. Three recoloured renders
of the private car were made (3/4 front, 3/4 back, top; not committed, since
they show the private model). The 396 attached parts were drawn light grey and
the 50 unattached parts in four colours:

- **Orange, engine cover (31 parts).** The `017cowl` submodel rests on the body
  like a lid. No seated clutch joins it to the car.
- **Magenta, steering wheel (2 parts).** A 4185a belt wheel with its 2815
  rubber ring, on the steering column's line beyond the end of its 8L axle.
  Nothing holds it on along the axle.
- **Green, stickers (13).** Decals with no connectors.
- **Blue, exhaust hoses (4).** Flexible LDCad hoses plugged in at both ends.

## Phase 1: one-body source cars in ordinary Play

**What it is.** When the reviewed source graph of a car has boundaries the old
rigid profile refused (`rigidWheelProfileCompatible: false`),
`planSourceVehicleArticulation` tries to explain every boundary. It refuses with
a plain reason otherwise. The rig is then the ordinary vehicle rig: one chassis
group plus the wheel groups. The articulation is a session-only drawing plan
attached to the derived vehicle.

**Physics.**

- **One body.** One dynamic chassis on the existing ray-cast wheels. One-body
  cars become dynamic automatically when the world's collision is complete;
  otherwise they drive kinematically as before.
- **Collision.** One compound of occupancy ≥ 0.5 merged convex member hulls
  (`compactArticulatedSource`, 163 hulls for the whole car).
- **Mass.** Mass, centre of mass and inertia come from the members' own hulls,
  not the merged hulls. The first benchmark's scraping came from merged-hull
  mass: a filled hull is heavier and top-heavy, so it pitched. With member mass,
  even a single whole-chassis hull drives 256 LDU with no scraping.
- **Clearance at entry.** A hull's lowest point is always a member's own point.
  Entry checks that the lowest chassis point clears the tyre contact plane by
  more than the suspension travel: 16 LDU against 5 for the 5540.
- **Collision budget.** The moving-collision budget counts the hull triangles
  actually used. The drawn source triangles are not counted. No cap was raised.

**Drawn articulation** (`articulateVehicleTransforms`, applied to the session
snapshot, so kinematic and dynamic Play, rendering and posed export all agree):

| Source boundary                                                  | Drawn as                                                                                                                                 |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `source-wheel-retained-pivot` to the chassis (4261 arm on 4262)  | Steering arm (4261, upper 4263 socket, 3706 axle, collars and 3749 linkage pin) turns about the reviewed upright pivot at X ±110, Z −200 |
| Front wheel groups                                               | Swing about the real pivot rather than their own centre (a pure translation correction)                                                  |
| Island pinned to both arms (3743 rack, 4263 sockets, 3460, 3023) | Slides sideways by the mean of its two pin displacements                                                                                 |
| Keyed column with a captured 4143 14-tooth gear beside the rack  | Turns by slide ÷ 17.5 LDU (nominal module 2.5 LDU per tooth). Turning right turns it clockwise for the driver                            |
| Nine hinges, rear axle bearings, keyed bushes                    | Held as built; Play says so                                                                                                              |

Nothing drives the hinges in the source, so "animated hinges" have no input.
They ride rigidly with the body and are listed as held.

**Ride-along parts** (`admitSourceRideAlong`, owner decision). Each part needs
its own evidence; anything else stays where it was built, with a plain reason:

| Part               | Evidence                                                                                                | Behaviour                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Cover (31)         | Coplanar support faces with positive area (`sourceSupportPatch`) on still body parts, under the cover   | Moves with the chassis and keeps its collision |
| Steering wheel (2) | 4185a centre within 0.1 LDU of the column axis, parallel within 1e−3                                    | Drawn turning with the column                  |
| Stickers (13)      | Reviewed backing (`reviewedStickerBacking`) fully seated (`sourceBackingSeated`) on body or cover faces | Drawn on its brick                             |
| Hoses (4)          | Reviewed hose geometry and both 752 caps seated on body studs (`sourceFlexibleHoseWitness`)             | Drawn riding along; its ends never move apart  |

The Play menu shows the vehicle's notes in plain words while driving, for
example:

> This car moves as one piece on its wheels. The steering arms, steering link
> and wheels are drawn turning; they are not simulated separately. Its 9 hinge
> joints stay as built while you drive. Along for the ride: the loose cover (31
> parts) rides on the body; the steering wheel turns with the steering; 13
> stickers stay on their bricks; 4 hoses ride along between their ends. They
> are not clipped on in the real model.

The committed excerpts have no bodywork under the cover and no steering
column. There, the cover and steering wheel correctly stay where they were
built ("33 loose parts stay where they were built").

**Measurements, Phase 1** (production build, `tests/browser/play-source-vehicle.spec.ts`,
SwiftShader Chromium on the shared ARM VM, not phone hardware).
"Phone" is 390 × 844 mobile emulation. Per-tick times include `stepTicks`
snapshots.

| Model                           | Viewport | Play entry | ms/tick driving | ms/tick turning |
| ------------------------------- | -------- | ---------: | --------------: | --------------: |
| Attached excerpt (84 parts)     | desktop  |  1.9–2.0 s |       1.47–1.66 |       2.01–2.14 |
| Attached excerpt                | phone    |  1.9–2.5 s |       1.08–1.27 |       1.31–3.26 |
| Whole 5540 (446 parts, private) | desktop  |  5.0–7.3 s |       3.06–4.12 |       2.73–4.71 |
| Whole 5540 (private)            | phone    |      7.0 s |       5.72–6.16 |       4.17–4.40 |

In Node on the same VM, the whole car's session ticks take 2.7–4.2 ms dynamic
and 8.0 ms kinematic (box sweeps); it travels 257 LDU in 2 s and turns 16.5° in
1.5 s. A chassis-relative posed export with full right lock shows both arms,
the rack, the column and the steering wheel turned, with the cover and stickers
in place (private render).

**Not yet:** linked hinge animation (no source input), Ackermann geometry (both
arms turn by the same angle, so the rack pins can drift up to about 5 LDU from
their link at full lock), suspension the source does not have, Arocs wheel
units, and phone hardware.

## Driver's-seat heuristic (follow-up)

The owner asked for a simple way to place a driver in detected cars that have
no authored seat. `guessDriverSeat` (`src/play/driver-seat-guess.ts`) returns
ranked candidates and says why it chose one, or gives a plain reason when none
fits. It is a placement guess for the seated pose and camera, not a claim of
authored seating; nothing is attached or moved.

1. **Seat parts.** It looks for the Minifig Seat 2 × 2 (4079 and its obsolete
   recolour). Each seat's hip point is 18 LDU above its origin, as the authored
   Roadster and Jeep seats use. The seat is paired with the nearest
   steering-wheel part 10–120 LDU in front of it, within 30 LDU sideways, at a
   plausible height. Recognised wheels:

   - 3829c01 and its recolours, 3828, 30663, 16091, 67811, 41850;
   - 30640c01/c02, 2819, 2741, 874;
   - a ride-along 4185a steering wheel.

   A forward-facing seat with a wheel ranks first.

2. **Empty cockpit gap.** With no seat part, it searches behind the front axle
   for a place where all of these hold:

   - the declared seated-figure boxes (`SEATED_BODY_PROFILE`) fit, allowing a
     3 LDU graze for part boxes;
   - something flat supports the hips (at least 15 of 25 samples);
   - parts rise beside the hips on both sides, so the figure is in the car, not
     on its roof;
   - there is headroom;
   - the line of sight forward is clear (transparent parts and the steering
     wheel excepted).

   Occupancy uses part bounding boxes, so the search is conservative. A refusal
   counts which check each place failed.

| Sample                    | Result                                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Roadster template         | 4079 seat with 3829c01 in front; the pelvis equals the authored seat exactly                                                                                   |
| Jeep template             | The driver's 4079 (behind the 3829c01) exactly at the authored seat; the passenger seat ranks second                                                           |
| 6503 Sprint Racer         | Empty cockpit gap behind its 3829c01, hips on the car base at (0, −13.3, 0)                                                                                    |
| 31027 Blue Racer          | Empty cockpit gap at (2, −40.9, −30); no steering-wheel part recognised                                                                                        |
| 30572 Race Car            | Refused: no place fits (18 had nothing flat to sit on, 156 were not between the sides, 21 were too narrow or low)                                              |
| 5540, whole car (private) | Refused once the cover rides along. The cockpit is two studs (40 LDU) wide; the seated figure needs 58 LDU at the arms. A Model Team car has no minifig driver |
| 5540 attached excerpt     | A gap on the bare chassis (no bodywork in the excerpt). It shows why the guess must run on the final rig, after ride-along                                     |

The guess is not wired into seat entry or the driving camera yet. The next step
is to turn a chosen guess into a `driverSeat` for derived cars (access point,
approach and exits beside the car), so the existing seat checks verify it
against real geometry. It takes 10–70 ms for the small cars but 0.9–2.6 s for
the whole 5540 on the VM, so it needs a spatial index before it runs at Play
entry. Tests: `tests/unit/play-driver-seat-guess.test.ts`.

## What the existing code already does

Ordinary Play already uses this pattern for the simple imported cars (Roadster,
Jeep, 31027, 30572). Each car is a dynamic chassis body whose colliders are one
convex hull per member occurrence (`mechanicalSolids`), on Rapier's
`DynamicRayCastVehicleController` with one ray per rotating wheel group
(`DynamicRig.createVehicle`). The 5540 is refused before that point:
`sourceVehicleAssemblyReview` reports `rigidWheelProfileCompatible: false`,
because the source graph has 55 fixed islands joined by bearings and hinges,
not one chassis. The native experiments in
[5540-WHEEL-ATTACHMENT-BOUNDARIES](5540-WHEEL-ATTACHMENT-BOUNDARIES.md) went
the other way: more bodies, more joints and source triangles. That
produced zero-clearance bore contacts and lost bearing gates.

The compact profile takes the existing rigid-vehicle representation and
applies it to the multi-island source graph. The open question is which source
freedoms it may lock, not how to make the physics cheaper.

## Approaches measured

All five representations are built from the same reviewed source data:

- Fixed islands and boundaries come from `deriveVehicleRigs(...).sourceAssemblies`.
- Wheel rays come from `reviewedAxleWheelMounts`: 4 assemblies (2 steering at
  Z−200, 2 rear at Z230), tyre centres at Y−54, reviewed radius 54.005 LDU,
  bearing axis X.
- Member geometry is compiled from the pinned library the way the renderer
  compiles it, then placed by each unchanged source transform.

| Representation         | What it is                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `islands-trimesh`      | One dynamic body per fixed island, one source-triangle trimesh per member; each source boundary is a fixed joint. This is the triangle approach the TODO describes. |
| `islands-member-hulls` | The same bodies and joints, one convex hull per member.                                                                                                             |
| `chassis-member-hulls` | **One body**, one compound of one convex hull per non-rotating member (364), 4 rays standing in for the 32 rotating rims, tyres and joining pins.                   |
| `chassis-clustered`    | One body; members merged into hulls by `clusterHulls` (below) at a minimum occupancy of 0.35 / 0.5 / 0.7.                                                           |
| `chassis-island-hulls` | One body; one hull per fixed island (33 islands contain non-rotating members).                                                                                      |

Fixed joints are the cheapest possible stand-in for the boundaries. The real
articulated graph needs revolute and prismatic joints, limits, motors and the
contact policy on top, so the island rows are a **lower bound** on its cost.

### `clusterHulls`: a member-granular approximate convex decomposition

This is a bounded relative of V-HACD that never cuts a part. A seed set (one per
fixed island, or the whole chassis) becomes one hull when the union of its
member hulls fills at least `minFill` of that hull. Occupancy is sampled on a
regular grid of about 2,048 points per candidate hull, with a point-in-hull
test against each member's own hull. Otherwise the set splits at the median
member centroid along its longest axis.

Every child contains complete member hulls, so no source surface moves inward;
coarser settings only add filled space. Hulls keep at most 64 points (directional
extremes plus a stride, the existing `proxyPoints` rule, which can only shrink a
hull). Work is bounded at 4,096 splits, 200 M plane tests and 512 hulls.

## Measurements

**Environment:** Node 22.14, `@dimforge/rapier3d-compat` 0.21.0 (WASM, the
app's pinned build), shared 4-core Neoverse-N1 VM (load average 0.8–1.1), 60 Hz
fixed step, gravity 9.81, 0.02 m/LDU. Each run builds a fresh world and rests 60
ticks. The single-body rows then drive 120 ticks forward, 120 ticks forward
while steering and 240 ticks in reverse. Step times are means and 95th
percentiles over every tick after the first. The first step, which builds the
broad phase, is listed separately. "Deep" counts touching contact points of two
different vehicle bodies penetrating more than 0.5 LDU. Snapshot bytes are
`world.takeSnapshot()`, a proxy for native memory. **These are VM WASM numbers,
not phone hardware.**

### Whole 5540 (private OMR source, SHA-256 `2f3717…2812715`)

Three trials, half-space ground (Play's session ground), compound collider.
Trimesh: one trial (60 ticks took about 40 s).

| Representation         | Bodies | Colliders / convex children | Joints |    Step ms mean (p95) | Setup ms (+ first step) | Internal pairs / points | Deep points | Max depth LDU | Peak speed LDU/s | Snapshot |
| ---------------------- | -----: | --------------------------- | -----: | --------------------: | ----------------------: | ----------------------: | ----------: | ------------: | ---------------: | -------: |
| islands-trimesh        |     55 | 396 trimesh, 237,866 tris   |     67 |         661.1 (927.4) |           259 (+ 2,288) |            225 / 87,919 |      17,738 |          16.0 |           16,974 |   234 MB |
| islands-member-hulls   |     55 | 396 hulls                   |     67 |           10.8 (12.0) |               47 (+ 14) |               153 / 503 |         432 |          47.2 |           17,176 |   3.4 MB |
| chassis-member-hulls   |      1 | 1 compound / 364            |      0 |           1.71 (2.41) |               229 (+ 2) |                   0 / 0 |           0 |             0 |              169 |   2.1 MB |
| chassis-clustered 0.7  |      1 | 1 / 263                     |      0 |           1.29 (1.83) |             1,500 (+ 2) |                       0 |           0 |             0 |              168 |   1.6 MB |
| chassis-clustered 0.5  |      1 | 1 / 151                     |      0 |           0.85 (1.21) |             1,165 (+ 1) |                       0 |           0 |             0 |              168 |   1.1 MB |
| chassis-island-hulls   |      1 | 1 / 33                      |      0 | 0.14–0.23 (0.38–0.55) |                  67–116 |                       0 |           0 |             0 |              167 |   0.3 MB |
| chassis-clustered 0.35 |      1 | 1 / 1 (one hull, fill 0.37) |      0 |         0.035 (0.057) |                29 (+ 0) |                       0 |           0 |             0 |              168 |    16 KB |

All single-body rows: all four rays in contact; 246–256 LDU forward in 2 s at
the unchanged 160 LDU/s limit (±2); about 22.8° of heading after 2 s of full
steering; reverse at −160 to −163 LDU/s. No chassis/ground contact at rest.

Separate colliders instead of one compound cost more: member hulls 2.42 ms,
clustered 0.5 1.20 ms, island hulls 0.31 ms. Each collider is its own
broad-phase proxy, and every one pairs with the infinite half-space.

With a two-triangle **mesh floor** instead of the half-space, the BVH can skip
far children: member hulls 1.30 ms, clustered 0.5 0.68 ms, island hulls 0.24–0.33
ms. The islands-member-hulls row stays at 11.2 ms, with 389 deep points.

### Coarse hulls change ground clearance

The member-granular hulls never go below the lowest chassis member (Y−16, so 16
LDU of clearance), but a convex hull bridges the gaps between low points. While
driving, the chassis/ground contact points summed over all ticks were:

| Hull setting              | Children | Fill (min / mean) | Scraping contacts (half-space / mesh floor) | Distance in 2 s (half-space / mesh floor) |
| ------------------------- | -------: | ----------------: | ------------------------------------------: | ----------------------------------------: |
| member hulls              |      364 |       1.00 / 1.00 |                                       0 / 0 |                             256 / 256 LDU |
| clustered 0.7             |      263 |       0.70 / 0.96 |                                       0 / — |                                   256 / — |
| clustered 0.5             |      151 |       0.50 / 0.82 |                                       0 / 0 |                                 256 / 256 |
| island hulls              |       33 |       0.33 / 0.95 |                                     18 / 67 |                                 249 / 164 |
| one hull (clustered 0.35) |        1 |              0.37 |                                      30 / — |                                   246 / — |

The 299-member main island is one hull that is two-thirds empty; under pitch
its bridged underside scrapes. **Member-granular or occupancy ≥ 0.5 hulls keep
the source clearance; per-island and whole-chassis hulls do not** and are
rejected as an admission representation.

**Correction (Phase 1):** the scraping came from mass, not shape. A
convex hull's lowest point is always one of its members' points. The
merged hulls carried the mass of all the space they fill, which made a
heavier, top-heavy chassis that pitched. With mass taken from the member
hulls (`--member-mass`), every row above, including the single 58-point
hull, drives 256 LDU with zero scraping contacts on the mesh floor. Coarse
hulls still fill cockpits and gaps for foreign contact, so Play uses
occupancy ≥ 0.5.

### Committed carrier-graph excerpt (117 occurrences, 84 attached, 52 islands, 109,448 triangles)

This is what the unit tests use (three trials; trimesh one).

| Representation        | Bodies | Children |    Step ms mean (p95) | Internal points |  Deep | Peak LDU/s | Snapshot |
| --------------------- | -----: | -------: | --------------------: | --------------: | ----: | ---------: | -------: |
| islands-trimesh       |     52 |       84 |         402.0 (537.6) |          38,835 | 8,530 |      8,421 |   139 MB |
| islands-member-hulls  |     52 |       84 |     4.4–4.7 (5.1–6.1) |             263 |   244 |     17,071 |   1.3 MB |
| chassis-member-hulls  |      1 |       52 |           0.14 (0.45) |               0 |     0 |        169 |   0.4 MB |
| chassis-clustered 0.5 |      1 |       36 |           0.12 (0.34) |               0 |     0 |        168 |   0.3 MB |
| chassis-island-hulls  |      1 |       30 | 0.13–0.17 (0.34–0.45) |               0 |     0 |        169 |   0.3 MB |

### Setup cost

On the same VM, for the whole car:

| Step                                | Time      | Note                                                                         |
| ----------------------------------- | --------- | ---------------------------------------------------------------------------- |
| Source review (`deriveVehicleRigs`) | 0.20 s    | Already runs on Play entry today.                                            |
| Member geometry compile             | 1.8 s     | Test-side only. Play already captures per-member geometry from the renderer. |
| 396 member hulls                    | 0.62 s    | Once per entry; worker-friendly and cacheable by part and transform.         |
| Clustering at 0.5 / 0.7             | 1.1–1.5 s | The occupancy sampling; member-hull mode needs no clustering.                |

The first two can be removed from the entry path entirely by hulling each
unique part once in its local frame and transforming it (86 unique members).

### Phone profile

Play has no phone-specific physics budget (`DYNAMIC_LIMITS` is shared). The
phone resource profile changes scene triangles and parts, not native bodies. No
phone hardware was measured. As an **unmeasured assumption**, a 3–5× slower
phone keeps the compact rows under 9 ms per tick (member hulls) and under 6 ms
(clustered 0.5), inside a 16.7 ms frame. Island hull bodies (32–54 ms) and
island trimeshes (seconds) do not. The memory row is clearer: 234 MB of native
state for the trimesh graph is not viable on a phone; 0.3–2.1 MB is.

### Foreign response

In `play-compact-vehicle.test.ts`, the clustered chassis drives into a 40 LDU
kerb wall. It touches it (contact points > 0), penetrates less than 3 LDU and
comes to rest (|speed| < 20 LDU/s) behind the wall face. The explorer, loose
parts and static world keep colliding with the hull compound exactly as they
do with an ordinary dynamic chassis.

## What is source-positive and what is approximated

| Aspect                                                       | Status in the compact profile                                                                                                                                                                                                                       |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chassis membership                                           | **Source-positive:** the reviewed attached graph (396 occurrences). Unattached occurrences stay world-owned.                                                                                                                                        |
| Collision surface                                            | **Conservative approximation:** complete member hulls (or occupancy ≥ 0.5 clusters) contain every source vertex. They fill each part's own holes, slots and concavities, as ordinary Play chassis hulls already do. Nothing is cut or moved inward. |
| Wheel stations, radii, axle                                  | **Source-positive:** reviewed tyre centres, the compiled 54.005 LDU envelope and bearing axes; steering only where the reviewed 4261–4263 pivot sockets exist.                                                                                      |
| Twin and triple tyres                                        | **Existing approximation:** one ray per coaxial stack (`per: "tyre"` gives 10 rays but needs suspension retuning; it bounced with the 4-wheel defaults).                                                                                            |
| Hinges (9), steering pivots (6), bearings (14), keyed slides | **Approximation: held at the build pose.** This is the policy decision.                                                                                                                                                                             |
| Steering geometry                                            | **Approximation:** rays steer about the tyre centre, not the real 4263 kingpin; no steering linkage is driven.                                                                                                                                      |
| Suspension                                                   | **Approximation:** the existing ray spring (rest 6 LDU, travel 5). The 5540 is unsprung; the chassis sags about 2.5–3.5 LDU at rest.                                                                                                                |
| Mass                                                         | **Declared:** density 200 kg/m³ over hull volume, like other dynamic chassis.                                                                                                                                                                       |
| Cowl (31), pulley/tyre (2), stickers (13), hoses (4)         | **Phase 1:** ride along on their own evidence (see the ride-along table); anything without evidence stays where it was built.                                                                                                                       |

## Risks

1. **Locked freedoms.** Holding hinges and bearings at rest is honest only if
   Play says so ("Hinged panels stay as built while driving"). Silently
   welding them would breach the rule that unsupported articulation stays
   static or is refused. The owner should decide whether a rest-locked
   driving profile is acceptable.
2. **Left-behind parts.** Supported but unattached parts (the cowl) must ride
   along through source support contacts, or the vehicle must be refused.
   Welding them would invent an attachment.
3. **Hull coarseness.** Coarse hulls scrape and fill cockpits. The occupancy
   threshold must be part of the admitted profile, and the measured clearance
   test should run per vehicle at entry (lowest hull point ≥ lowest member
   point, and no static hull/ground contact at rest).
4. **Step cost scales with children near other geometry.** 364 children cost
   1.3–1.7 ms alone. Several such vehicles, or a dense static world, multiply
   that. A cap of 512 children per vehicle is declared; phone cost is
   unmeasured.
5. **Ray suspension is a gameplay model.** It hides tyre contact patches and
   twin-tyre load sharing, and visual wheels follow the controller, not the
   collision geometry.

## Winch and pivoting cylinders (synthetic cost sketches)

`tests/helpers/systems-sketch.ts` contains two **synthetic** models (box
masses, no source geometry, no evidence) that measure cost and check behaviour.

**Winch:** a drum on a revolute joint whose motor is the driving input, and a
rope modelled as a unilateral soft distance constraint whose length follows the
wound drum angle. Rope tension pulls the load and applies r × T to the drum, so
an unlocked drum back-drives. A one-way pawl is a zero-velocity motor applied
only while paying out. That is 2 bodies and 1 joint, with no rope bodies.

It winds a 5 kg load up 16.5 LDU in 2 s (2.05 rad on an 8 LDU drum), holds it
within 5 LDU on the pawl, and drops it when released. **0.077 ms per tick**
(p95 0.11).

Source evidence still needed:

- The actual driving input. The reviewed excerpt has none; the motor and
  gearbox route lies outside it.
- The rope path and anchor points from the set's string, pulleys and hook.
- Whether anything really locks the drum. The reviewed 1:8 worm is an ideal law
  that does **not** claim self-locking, so a pawl is not source-positive unless
  a real ratchet or brake part is found.

The existing five-body native worm packet would drive the drum in place of the
motor.

**Pivoting cylinder:** an arm hinged to a base; a cylinder case pinned to the
base; the rod on a prismatic guide inside the case; the rod eye pinned to the
arm, closing a loop. Pressure force acts along the current case axis. That is 3
bodies and 4 joints per cylinder.

A 4,000 N push lifts the arm about 20°; releasing it lets the arm fall back.
The loop closure error stays under 0.4 LDU while driven and 0.01 LDU at rest.
**0.08–0.11 ms per tick.** The four Arocs crane cylinders would add about
0.4 ms.

Source evidence still needed:

- The actual cylinder mount pins and arm pin holes. The pivots must come from
  real pin and hole interfaces, like the reviewed ball links.
- The crane arm's hinge axis and ownership.
- Reuse of the reviewed 19466c01/19467c01 guide, stops and seal allowance for
  the prismatic joint, with pressure from the existing `NativePneumaticCircuit`
  rather than a constant force.
- Tubes that follow both moving ends (render-only bending), and the lever
  linkages.

The pump's PF-L crank drive needs the reviewed motor rotor and a crank pin, both
source interfaces.

## Recommended path

Steps 1 to 3 are done (see [Phase 1](#phase-1-one-body-source-cars-in-ordinary-play)).

1. ~~Owner decision on a rest-locked profile.~~ The owner chose one body with
   animated steering and hinges, and ride-along loose parts.
2. ~~Phase 1, compact chassis.~~ Shipped for one-body source cars. Still to do:
   hull each unique part once in a worker and cache it (entry takes 5–7 s for
   the whole car in SwiftShader), and measure on a real phone.
3. ~~Phase 2, ride-along accessories.~~ Shipped as drawing plus the cover's
   collision on the one body, each on its own evidence. A second body was not
   needed.
4. **Phase 3, selective articulation.** Give the player inputs for freedoms
   the source really has, such as hinged panels as drawn groups with a control.
   Add Ackermann steering if a source linkage defines it. Keep the body count
   at one unless contact through a moving part matters.
5. **Phase 4, Arocs and the systems.**
   - Arocs: apply the same profile with `arocsWheelUnits` (12 tyres, 8 units,
     4 stations). Per-ray station heights carry the reviewed 0.56 LDU
     front/rear difference without a common-plane shortcut.
   - Crane: use the pivoting-cylinder model on reviewed pins, driven by the
     existing circuit kernel.
   - 42042 winch: the worm packet drives the drum, plus the soft rope once its
     source path and load are reviewed.

## Reproduce

```sh
npx vitest run tests/unit/play-compact-vehicle.test.ts tests/unit/play-source-vehicle-articulation.test.ts tests/unit/play-systems-sketch.test.ts --maxWorkers=1
npx playwright test -c <private config> --project=main tests/browser/play-source-vehicle.spec.ts
npx tsx scripts/compact-vehicle-bench.ts .local/5540-1.mpd --member-mass --fill=0.35,0.5   # private whole car
```

The whole-car unit test and browser cases skip unless the private
`.local/5540-1.mpd` exists.
