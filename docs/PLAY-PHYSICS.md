# Motors, dynamic physics, automatic doors and posed export

This slice closes the remaining M5 items (joint motors and rotating axles, validated mechanism inputs in automation, posed-export controls, and hinged doors without manual rigging) and adds the first M6 slice: optional dynamic rigid assemblies, constrained joints with motors and dynamic vehicles with suspension (spec 19.3–19.5, M5/M6). Everything here is session state. Play never writes to the authored project; the only persisted additions are optional rig physics settings, which are saved through an explicit, undoable rig command.

## Engine and dependency decision

The spec proposes Rapier as the optional physics engine (spec 3.1). Play already bundled `@dimforge/rapier3d-compat@0.21.0` (Apache-2.0, lazy-loaded with the Play chunk) for the walking capsule. The dynamic slice uses the same pinned package: rigid bodies, impulse joints with motors, convex hulls and its ray-cast vehicle controller. No new dependency was added, so the dependency notices and lockfile are unchanged. The dynamic world is separate from the walking world. Exactly one dynamic step runs per fixed 60 Hz tick, independent of the extra query refreshes the walking world uses.

## Joint motors (kinematic)

Authored `motor` metadata on revolute and prismatic joints now runs in Play. Kinematic rigs have no forces, so a motor moves at a declared rate. Position motors travel to their target at 90 degrees/s or 40 LDU/s. Velocity motors run at their target speed; an unlimited revolute joint is a continuously rotating axle, with its angle folded by whole turns. Each step uses the same swept actor-clearance check as other joint motion. A motor stops before touching the explorer, reports `blocked` and retries on later ticks. It reports `at-limit` at a limit and `holding` at its position target.

Motors start running when Play starts. `play.setMotor({rigId,jointId,enabled})` or the drawer's **Stop motor / Start motor** button toggles one. A manual joint command (slider, `setMechanismJoint`, joint target or the nearby action) stops that joint's motor. Reports carry `motors[jointId]` with mode, target, units, status and whether they are simulated at a kinematic rate or as a dynamic motor.

## Dynamic physics (opt-in)

`play.enter({rigIds, dynamicRigIds})` simulates the named active rigs dynamically. In the UI, the choice is **Play → Mechanism physics → Dynamic**, a folded section shown only when the build has authored rigs.

- **Bodies.** Each authored rigid group is one body. Individual bricks are never separate bodies (spec 19.4). Moving groups get one convex proxy per member occurrence. Its points are deduplicated on a quarter-LDU grid and reduced to at most 256 points using directional extremes, so the proxy can shrink but never grow. A flat member gets a thin box. Anchored groups keep their exact triangle surfaces, so a door frame keeps its opening.
- **Anchoring and mass.** Root groups of non-vehicle rigs are anchored by default, such as a door frame or an axle post. Vehicle groups and explicitly unanchored groups move. Mass comes from proxy volume at 200 kg/m³, or from an authored `massKg` per group. Friction defaults to 0.7.
- **Joints.** Fixed, revolute, prismatic and spherical joints become Rapier impulse joints with authored limits. Bodies of one rig do not collide with each other. Authored motors use `maxEffort` (N·m or N at the 0.02 m/LDU gameplay scale). An animated joint target, from the nearby action, the drawer slider or `setJointTarget`, moves a motor setpoint at the requested speed. The target completes within 1° or 0.5 LDU and reports `blocked` if it stalls for 1.5 s. `setMechanismJoint` (an immediate pose) is refused for dynamic rigs.
- **Vehicles.** The chassis is a dynamic body driven by Rapier's ray-cast wheel controller. Each authored wheel becomes a sprung wheel at its declared centre, radius and axle. Engine force, a holding brake at zero throttle, and the authored `maxSteerDegrees`/`maxSpeed` apply. Steering uses the kinematic sign convention. Wheel groups are drawn from the suspension length, steering and rolling angle. Suspension, engine force and friction are optional rig settings. Driver seats keep the kinematic profile: a dynamic vehicle offers **Drive vehicle**, not seated entry.
- **Explorer.** The walking capsule is a kinematic body in the dynamic world, so bodies cannot fall through the explorer. Dynamic bodies are mirrored into the walking world, where the explorer can stand on them, and walking into a loose body applies a bounded push. Bodies never push the explorer, and riding moving bodies is not simulated. Kinematic rigs appear in the dynamic world as kinematic bodies, so an animated door pushes a crate.
- **Limits.** At most 14 dynamic rigs, 64 bodies and 512 dynamic member proxies, with the existing 32-rig, 128-group and 200,000-moving-triangle Play budgets. The dynamic world needs complete included collision geometry. A member without surfaces, an anchored vehicle chassis and settings for unknown groups each fail with an actionable message before any simulation starts.
- **Reports.** Dynamic reports use `mode:"dynamic"` and `dynamics:{engine,gravity,bodies,wheels?,speed?}`. They also carry per-body mass, collider count, sleep state and velocities (LDU/s, degrees/s), and per-wheel contact and suspension length (LDU).

Reproducibility follows spec 19.4: identical inputs and tick counts give identical reports in the pinned engine and browser (unit and CLI tests replay runs byte-for-byte). This is not a cross-platform numerical guarantee. The simulation settings describe the chosen simulation, not measured clutch power.

### The playground park sample

The **Playground park** sample (see [templates](TEMPLATES.md)) shows dynamic physics out of the box: its rigs set `dynamics.startDynamic`, so the Play card opens with **Mechanism physics · Dynamic** chosen, and its one-line Play hint (“Push the crates and barrels, then swing!”) shows on the Play card and for six seconds when Play starts (`project.scene.playHint`, `scene.set` command). Walking into a crate or barrel pushes it across the tiled plaza; walking into the swing seat swings it up to its ±70° limit; the see-saw tips about its post and the roundabout turns. Unit and browser tests push crate 3 at least 20 LDU with its height within 3 LDU, and swing the seat.

### Physics settings (rig authoring)

**Inspector → More tools → Physics settings** loads an existing rig and edits which groups are anchored, group masses, friction, and for vehicles the suspension (spring length and travel in LDU, stiffness, damping) and engine force, and **Start Play with dynamic physics** (`startDynamic`). Review runs a dry run; saving is one undoable `rigs.upsert`. `buildRigDynamicsDraft` changes only `rig.dynamics` (`null` removes it). Mechanical rig editing preserves these settings, and they round-trip through native projects. Standard LDraw export ignores them.

## Automatic doors (official LDraw doors)

Official LDraw hinged leaves (doors, window panes and shutters, gates and trapdoors) open in Play without manual rig authoring.

- **Table.** `src/play/door-parts.json` lists 228 official hinged leaves, including patterned and sticker variants, with a hinge axis, a pivot, the leaf direction, width and height, and hinge pins where the connector pack has them. It also lists 55 explained exclusions: sliding, lift, roller, garage, revolving and portcullis doors, and parts with no hinge convention. Official `~Moved to` names resolve through `aliases` (for example 3861 → 3861c). `scripts/build-door-table.ts` rebuilds it from the committed complete LDraw pack and its derived connector pack (`npx tsx scripts/build-door-table.ts`, then Prettier; release and `complete.zip` sha256 recorded in the file). Candidates are chosen by `doorCandidate(title, category)` from the pack's catalogue: every door (including doors "with Window"), window panes and shutters, gates in the fence, bar, door and Duplo categories, and trapdoors. Frames, glass, stickers, subparts and assemblies that merely hold doors ("Cupboard … with Blue Doors (Complete)") are not candidates. Four rules in `src/play/door-derive.ts` then derive each hinge from geometry:

  - _Origin-edge_: LDraw hinged parts put the origin on the rotation axis. A thin vertical slab with the origin on one width end hinges vertically there (60616/60623/60621/79730/92589/40241 +X, 73194/73312/73313/47899/3861/3644 +Z, 93096/87601 −X, cupboard doors 4533/4535/6196, panes 3854/60608 and shutters 3856/3582 −Z).
  - _Flap-edge_: a thin horizontal slab with the origin on one edge hinges along that edge (trapdoor 30042).
  - _Hinge-pins_: collinear hinge-pin primitives define a horizontal axis, as for the 4346 container drop-down door on its two pins at (±16, 44, −26) and the tilting panes 30046/30045 of the rounded-top window 30044.
  - _Connector-pins_: a leaf no geometric rule explains takes the upright hinge pins of the derived connector pack (door 671). Pins that agree with a geometric rule are recorded too.

  Tests pin representative values and re-derive every leaf in the pinned library pack (60616a/b, 60623, 60607, 60608, 4346) from the shipped geometry.

- **Runtime rigs.** When Play starts, each included official hinged leaf that is not already in an authored rig is hinged to the nearest other part whose box reaches its hinge line within 16 LDU: its frame, container, shutter holder or supporting wall. Doors sharing a holder become one rig with one joint each. These `auto-door:N` rigs are session-only kinematic rigs; the holder and leaf use the existing moving-collider path, so the explorer can walk through an opened door. Mirrored, scaled or sheared doors, doors without a holder, and doors beyond the moving-part budget are listed in `snapshot.autoDoors.skipped` with a reason.
- **Swing direction.** LDraw has no door-stop data. At entry, an inset convex proxy of the leaf is swept around the hinge in 5° steps, up to 90° each way, against the rest of the Play world. How far it turns freely each way (at least 15°) becomes the door's limits; a frame's stop lip blocks the other way. A door authored ajar can therefore both close until it meets its frame and open further. Doors free both ways open away from the explorer, like push doors. A door blocked both ways is not offered. The decision is reported as `swing` (`positive`, `negative`, `both` or `blocked`).
- **Control.** Nearby doors show **Open door / Close door** in the existing contextual action (tap on touch, E on desktop). Automation uses `play.interact()`, `play.setJointTarget({rigId:"auto-door:0",jointId:"door",…})` or the CLI `--open-doors`. `play.enter({autoDoors:false})`, the CLI `--no-auto-doors`, and the UI's **Static build** choice keep doors closed.
- **Fixtures.** The **Door room** template (`fixtures/ldraw/door-room.ldr`) is an original CC0 room of catalogue bricks around a real 60596 frame holding a 60616a door. The frame blocks the inward swing, so the door opens outwards. `fixtures/ldraw/omr-doors.mpd` is an original CC0 door study that authors doors the way official models do (next section).

For catalogue leaves the verified connector pack is authoritative ([connectors](CONNECTORS.md)): `hingeData(ref)` supplies the pivot, axis and pins, so Play swings a door about the same pins the editor seats it on. A holder whose hinge sockets meet the leaf's pins within 1.5 LDU is preferred over the nearest box. The sockets come from the catalogue pack (60596, 60599) or, for other frames, from the complete library's connector pack when its shard is loaded (30179, 4132). The pack and the geometry-derived table agree for 60616a, 60623 and the panes 60607/60608 (pinned by a test). Leaves outside the catalogue render and collide once the complete library has loaded their geometry, which Play waits for at entry.

### Doors in official models

Doors in official LDraw OMR sets (Project → Official LEGO sets) were often not recognised. The Tree House 21318-1 was the reported case; eight other sets were studied as well. The files were fetched once each (3 s apart) and kept out of the repository. The causes, in order of impact:

1. **Rounded rotation matrices.** OMR files write rotations with three or four decimals (`0.707`, `0.866 0.5`, `0.661 … 0.75`), which are orthonormal only to about 1e-3. Play required 1e-6, so a door rejected as "Scaled, mirrored or sheared" was one placed at any angle other than a multiple of 90°. So was every door inside a submodel placed at such an angle, and every door authored ajar. Doors and mechanism members now accept rotations within LDraw's rounding (`nearlyPhysical`, 5e-3; `LDRAW_ROTATION_TOLERANCE` in `src/core/math.ts`), and rig group frames use the nearest exact rotation (`orthonormalized`). Rest poses keep the authored matrices. True mirrors are still refused, now with their own reason.
2. **Title filter.** The table took parts whose title contains "door" and dropped any with "window" in it, which lost doors such as 40241 "Door 1 x 4 x 6 with Window". Window panes, shutters, gates and trapdoors were never candidates. Candidates now come from the catalogue category and title (above), and every candidate is derived or listed with a reason.
3. **Ajar doors.** A door modelled open swung only when fully free both ways from that pose. The per-direction reach now lets it close to its frame.
4. **Embedded copies.** An OMR file may embed an official part as a custom part named `<set> - <part>.dat`. Play hinges it as the official leaf it copies when that part is in the table.

Coverage, counting hinged leaves in each main model (doors, panes, shutters, gates, trapdoors, container doors, including every instance in submodels) and garage/roller doors. Before is the previous table and rules; after is this change (`.local` study script, not committed):

| Set     | Model                  | Leaves present                                      | Recognised before | Recognised after | Not recognised after                             |
| ------- | ---------------------- | --------------------------------------------------- | ----------------- | ---------------- | ------------------------------------------------ |
| 21318-1 | Tree House             | 3 doors                                             | 1                 | 3                | none                                             |
| 10264-1 | Corner Garage          | 10 doors, 1 container door, 10 roller-door segments | 3                 | 11               | 10 roller segments (sliding: excluded by design) |
| 10182-1 | Cafe Corner            | 2 doors, 5 panes (4133), 10 tilting panes (30046)   | 7                 | 17               | none                                             |
| 376-2   | Town House with Garden | 1 door, 4 panes, 4 shutters (3856)                  | 3                 | 9                | none                                             |
| 374-1   | Fire Station           | 6 doors, 4 panes, 2 shutters (3582)                 | 10                | 12               | none                                             |
| 3315-1  | Olivia's House         | 4 doors, 10 panes, 4 roller-door segments           | 14                | 14               | 4 roller segments                                |
| 2150-1  | Train Station          | 6 doors, 8 panes                                    | 14                | 14               | none                                             |
| 4954-1  | Model Town House       | 2 doors, 16 panes                                   | 18                | 18               | none                                             |
| 6059-1  | Knight's Stronghold    | 1 gate door (4611), 2 doors (2400)                  | 3                 | 3                | none                                             |

Roller and garage doors (4218b, 4219b, 822x) slide in rails rather than swing, so they stay explained exclusions. Doors hinged on clips or bricks with no frame work when a holding part touches the hinge line. The tests (`tests/unit/play-auto-doors-omr.test.ts`, `tests/browser/official-set-doors.spec.ts`) use the original fixture above, never OMR files. The browser test serves it through a mocked `/api/omr/21318-1.mpd` and opens it from the Official LEGO sets search.

## Static posed export

Spec 19.5 requires rest-pose export by default and an explicitly requested static posed snapshot. `play.exportPosedModel()`, `mechanisms.exportPosedModel()` and the CLI `play --posed-output file.mpd` write every active mechanism's current placements, including automatic doors and dynamic bodies, into a private copy and export standard MPD text. Shared definitions are made unique in that copy only. The project, its rigs and the rest-pose export are unchanged. Re-importing yields plain parts at the posed placements. `mechanisms.applyPose()` remains the undoable way to edit the project.

## Performance

Measured by `tests/browser/play-physics-performance.spec.ts` on the Linux ARM64 VM with software WebGL (SwiftShader), with other agents sharing the machine. Tick costs are means over 300 fixed ticks with the car driving, the spinner motor running and the explorer walking. Frame times are realtime rAF intervals and are dominated by software rendering. See [verification](VERIFICATION.md) for the table. An idle-rig fast path, which skips pose sweeps and collider updates for kinematic rigs that cannot move this tick, offsets the per-tick cost of motors.

## Not implemented

Riding dynamic or kinematic platforms, and seated driving of dynamic vehicles. Clutch strength and breaking assemblies. Sliding, roller and lift doors. Auto-rig proposals for other connector families (spec 19.5 future assistant). Compound-rig and arbitrary-frame authoring UI. Measured phone-hardware frame times.
