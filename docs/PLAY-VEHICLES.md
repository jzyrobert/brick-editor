# Protected kinematic driving

Play supports remote driving from on foot and entry through an explicitly authored driver seat. Movement keys drive the selected source-supported vehicle; on touch screens the walking joystick splits into two pads while driving, a vertical throttle under the left thumb (forward and back, springing to a stop; it drives from wherever the thumb lands on its knob) and a horizontal steering pad under the right thumb (springing to centre), each tracking its own finger so both work at once. Get out and Stop driving stand above the steering pad and also respond to a second finger. Stop driving returns to walking controls. Kinematic vehicles stop conservatively before included static geometry or another active rig. Dynamic chassis response, suspension and authored seats are described below.
Nearby **Get in** takes control of a certified vehicle, switches to third person and frames the complete vehicle with a fixed chassis-local bounding sphere. Turning or wheel rotation does not refit the camera distance. The centered chase view smoothly follows the chassis heading, including a source car whose forward axis was rotated. Manual look stays where placed while parked and eases behind the moving car after 1.25 seconds. Reverse retains the rear view. Driving uses the normal Play near plane rather than the mechanism overview's tiny near plane, preserving depth precision on nearby blocks. Movement keys or the touch joystick drive it; dragging the view orbits the vehicle. The explorer is hidden and its native collider is disabled until exit. This possession does not invent a seat or attach passenger mass. Kinematic vehicles stop conservatively before included static geometry or another active rig. Dynamic chassis response, suspension and the separate explicit seat API are described below.

**Get out** brakes first, then checks bounded candidates beside the vehicle's current geometry for both supporting ground and capsule clearance. A successful exit restores the explorer beside the vehicle and its previous camera mode. If every candidate is blocked or unsupported, possession remains active and the interface explains why exit failed. Captures use the same avatar visibility as live Play. `vehicleControl.rigId` and `positionAnchor:"vehicle-reference"` identify this state in snapshots; its position is a camera/vehicle reference, not standing feet or an authored seat.

The supported profile requires exactly the authored chassis and declared wheel groups, no extra groups or joints, complete compiled geometry, and world-horizontal wheel axles. A chassis box encloses all its compiled vertices. Wheel envelopes enclose complete spin and steering motion. These conservative shapes can stop the vehicle before visible surfaces touch. Unsupported rigs retain their source and other exploration/joint functionality; driving is disabled with an explanation. Authored vehicles must pass the same real wheel/tyre and mounting checks. Mathematical cylinder wheels do not make a drivable vehicle.

## Imported cars without explicit power

Play also derives session-only vehicles from an imported stable wheelbase. The
source-reviewed wheel and holder combinations are:

| Holder | Rim + tyre                       | Source mounting              |
| ------ | -------------------------------- | ---------------------------- |
| `4600` | `4624 + 3641`, `6014b + 56890`   | One axle per wheel-pin plate |
| `2441` | `4624 + 3641`                    | Two axles on the car base    |
| `6157` | `93593 + 50951`, `93595 + 50951` | One axle per bearing holder  |

Exactly four matched wheels must form two parallel axles, with their holders
connected through real chassis stud interfaces. Radii come from the complete
source tyres. No motor or vehicle metadata is needed.

Authored rigs and trains reserve their members first. Two separate connected
cars stay separate; root-level scenery remains static. Missing tyres, ambiguous
mounts, disconnected holders, unsupported wheel families and incomplete bounds
remain static. Stable arbitrary horizontal yaw is supported: the source holder
axis defines a rigid session driving frame, while the original rounded LDraw
transforms remain unchanged. Tilted or ambiguous wheelbases are not snapped into
a supported pose. Detection is bounded to eight vehicles, 600 parts per vehicle, 256 wheel parts, 128 holders,
2,000 nearby candidates and 100,000 connector comparisons. No seat is invented.
The original document, LDraw export and inventory remain unchanged.

A separately rooted imported minifigure remains included foreign geometry, even
when it appears to sit in a car. Play does not invent a passenger weld, seat or
collision exemption. Such a figure can correctly stop the car before movement.

For a supported vehicle session, the optional temporary ground is lowered once
from source Y=0 to enclose the complete certified vehicle geometry and wheel
support envelopes. Unrelated scenery and other nonvehicle groups do not choose
the car’s supporting plane. Walking, native bodies and vehicle checks share this immutable
plane. Nonvehicle sessions keep Y=0, and `ground:false` still adds no plane.
Authored parts, wheel radii and contact tolerances stay unchanged; included real
floors and foreign obstacles still respond. This supplies a session floor, not
a source shift or an automatic suspension/pose correction. See
[the ground policy review](reviews/VEHICLE-SESSION-GROUND.md).

The complete included static triangle mesh is cached in a spatial index (a BVH). Foreign moving meshes use accepted poses and are rebuilt only when those poses change. Floor and wall triangles remain separate collision candidates, allowing flat ground contact without ignoring walls in the same mesh. Excluded Play layers are excluded from this world; ordinary editor visibility does not remove collision geometry. The optional session-only ground has an explicit plane check.

Each fixed tick processes rigs in sorted ID order. Translation casts and conservative rotation envelopes check the whole candidate movement. A refused movement restores the previous pose and wheel travel and clears throttle. Its reason persists through idle ticks and neutral release. New throttle or a steering change explicitly retries; reversing can move clear. Captures include the collision report and accepted pose. Authored transforms are unchanged until an explicit pose-application command.

**Sweep work.** The BVH gathers every triangle a move's swept proxies could reach and skips pure support: a triangle (or whole BVH branch) whose top is no higher than every box's bottom throughout the move can never be touched, so floors, studded plates and ground under a vehicle cost nothing. The remaining candidates become one transient triangle mesh, so a sweep costs `angular segments × boxes × 2` contact/cast queries however many triangles are nearby (Rapier's own BVH does the rest), and a blocked move still reports the nearest source triangle. Yaw is swept continuously: a heading read back from a frame wraps at ±180°, so each move is reduced to the short turn from its start (a single tick never turns half a revolution). A turn needing more than one query's 128 angular segments is split into up to 16 substeps, each checked in order.

The adapter uses metres with positive Y up, converted from public LDU coordinates at the boundary. It refuses coordinates outside ±10,000 metres, extents over 1,000 metres, translation over 100 metres per query and yaw magnitude over 10,000 radians. These are numerical safety bounds, not precision guarantees at the extremes. Each query is bounded to 32 boxes, 128 angular segments, 4,096 candidate triangles and 16,384 contact/cast queries per snapshot (static or foreign). Complete static and foreign geometry retain their separate triangle budgets. Geometry is never silently omitted: a move whose work would exceed a budget is not accepted. That is not a collision, so it is not reported as one — the vehicle (and a seated rider) simply holds its pose for that tick, keeping the driver's input and showing no stop reason, and the next tick tries again.

Before this, driving a seated figure round through due south (heading ±180°) failed: the rider's body sweep saw its yaw jump from +179° to −179° as a 358° turn, needed over a thousand angular segments and stopped the vehicle with "Body transfer exceeds collision work budget". The jeep template showed it within seconds of steering and driving together.

Tests include floor contact, thin walls, intermediate turning contact, mixed floor/wall meshes, foreign rigs, source-vertex envelope containment, out-of-domain values, deterministic two-vehicle contention, blocked release/retry, camera-relative steering and source immutability. Browser checks drive the actual demo vehicle into its doorway, reverse away, and verify the captured report. Authored seat entry/exit and dynamic chassis response are implemented below; low cabins and general articulated driving remain unfinished.

### Source cars with hinges and steering arms (one body)

Some reviewed source cars, such as the 5540 Formula 1 Racer, are not one rigid
chassis: hinges, steering arms and bearings join their parts. When every such
boundary is explained, the whole attached graph still drives as one chassis on
ray-cast wheels. It is dynamic when the world's collision is complete and
kinematic otherwise.

- **Drawn articulation.** Steering arms are drawn turning about their reviewed
  pivots, a rack pinned to both arms slides, and a geared steering column
  turns. Hinges stay as built.
- **Riding parts.** A resting cover, a steering wheel on the column, seated
  stickers and hoses plugged in at both ends ride along. Each needs its own
  evidence; other loose parts stay where they were built.
- **Plain words.** Play explains all of this while you drive.

See the [review](reviews/EFFICIENT-VEHICLE-AND-SYSTEMS-PHYSICS.md#phase-1-one-body-source-cars-in-ordinary-play).

## Authored driver seat

The seat slice adds an explicit `vehicle.driverSeat` record with the `brick-figure-open-seat-v1` profile. Positions use chassis-local LDU, with negative Y up: `pelvisPosition` anchors the seated pelvis, `accessPoint` is the interaction target, `approachPosition` is a standing-feet location, and `exits` holds 1–4 ordered standing-feet locations with yaw in degrees. Each coordinate is bounded to ±10,000 LDU; yaw is bounded to ±360 degrees. These data bounds do not certify physical clearance.

Seat metadata survives native backup and representable vehicle editing. `buildDriverSeatDraft` changes only the seat record, preserves the original mechanics and checks revision, visibility, locks and active-layer scope. Its normal rig command saves one undoable edit; `null` explicitly removes the seat. Data tests cover backup, alias isolation, malformed records, stale/locked edits and one-step undo without changing exported part geometry.

A valid seat record alone does not prove entry, rider clearance or a safe exit. The explicit `play.enterVehicle({rigId,seatId})` API retains the physical seated transfer independently of the nearby possession action. Seat entry requires Walk mode, a reachable access point, a clear line to that point, a supported standing approach and a swept transfer into the seat. Full wheel spin/steer envelopes must also clear the seated body. The conservative transfer raises the body through clear space, changes its rigid pose, moves above the seat and lowers it onto the anchor; it needs open overhead space. Seat entry defaults to third person with the explorer hidden; explicitly selecting first person uses the actual seated eye. There is currently no boarding animation.

The LDraw minifig figure uses whole rigid legs rotated about the hip axle, with no knees, mesh deformation or rescaling. The seated head follows the look like the standing one: it turns with the view within ±0.7 rad of the body and nods forward with it (down to −0.35 rad) but never tips back, which would swing the hair into a backrest; the torso/head box contains every such pose. As the third-person camera swings on round to the front the head eases back to straight ahead, so the driver's face is seen. The seated chase camera is centered behind the driver and follows the driving heading through a 0.18-second damped turn. Manual look still orbits a full 360°; after 1.25 seconds without another look input, a moving car eases the view back behind it. A parked or blocked car keeps the chosen orbit, and reversing keeps the view behind the chassis. The camera sweep ignores the occupied vehicle and its rider sensors, so a backrest or roll bar cannot repeatedly shorten the arm. Included world geometry and foreign rigs still retract it immediately, with eased recovery; vehicle and rider physics retain their full collision checks. Its separately declared torso/head and leg collision boxes remain independent of artwork (profile id unchanged; since the minifig figure the boxes are 58 × 63.5 × 52.5 and 40 × 21.3 × 40 LDU, the pelvis is the hip axle 28 LDU above the feet and the eye 58 LDU above the pelvis). The open-bench example seats the pelvis 22.5 LDU above the chassis origin so the hips rest on the cushion. The eye anchor is fixed by the seat profile; standing camera settings are retained for exit. First person hides the entire avatar. Third person shows the seated figure. Driving sweeps the rider and vehicle before accepting their new poses; foreign moving mechanisms also stop before the seated body.

**Get out** checks the ordered authored exits in the vehicle's current frame. Each exit needs real walkable support and a clear swept transfer. Player-owned collision sensors never count as floor. If every exit is blocked, occupancy remains, driving input stops and the player can reposition or leave Play. Fly, teleport and spawn changes require exiting the seat first. Captures freeze seat mutations and report occupancy, pelvis/root/eye anchors, local look and the seated pose without changing authored source.

The **Off-road jeep** and **Roadster car** samples each have an authored driver seat (a Minifig Seat 2 × 2 with the hips 18 LDU above its cushion). The roadster is four wide: its sills are two plates high so the figure's hips fit between them and its arms rest over them, the steering wheel is two studs ahead of the hips and the row behind the reclined backrest is open. The fixture **Open-bench vehicle** supplies a minimal authored example. The coordinate editor reviews only metadata; Play is responsible for geometry checks. Moving-platform support and seated dynamic suspension are implemented; inferred seats, low-cabin fit and articulated vehicles remain separate work. The earlier mobile scores apply to remote driving and source recovery; the new seat flow independently scored 8.7/10 after fixing chase-camera framing and moving the exit card away from the driver.

## Dynamic vehicles

Entering Play with dynamic physics (`dynamicRigIds`) replaces this kinematic profile for that session. The chassis is a Rapier body on sprung ray-cast wheels, with engine force, brake and authored steering and speed limits. Dynamic vehicles can be driven remotely or entered through an authored open-bench seat. The avatar and declared zero-mass collision boxes attach to the actual chassis, including suspension and tilt; standing approaches and ordered exits find nearby walkable support before accepting the transfer. Dynamic native contacts resist a head-only obstacle without changing chassis mass. See [Play physics](PLAY-PHYSICS.md).
