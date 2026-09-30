# Running trains

LDraw has the train parts, and Play can now run trains on them. A train standing on official track moves along the rails in Play: press **Go**, set the speed, reverse, ride along with it and throw the points to send it into a siding. Like automatic doors, trains are derived when Play starts and are session-only: the project is never changed. The **Railway station** sample shows it all ([templates](TEMPLATES.md)).

## What the official library has

The complete official library (`ldraw-full-2026-09-28`, 24,735 parts) has **434 parts in its `Train` category**, plus train motors, power pick-ups and speed regulators in `Electric`, 42 `Monorail` parts and Duplo train track. These are the ones that matter for running trains.

**Track** (every number below is read from the part files and pinned by `tests/unit/play-track.test.ts`):

| System                  | Parts                                                                                                                                                                                                                               | Geometry                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Plastic (RC/PF/Powered) | Straight 53401, Curve 53400 (and 53400c04, four curves as one part)                                                                                                                                                                 | Rail tops 16 LDU above the origin, sleepers' undersides 8 below (one brick high); ends at x = ±160 |
| 9V                      | Straight 74746 (was 2865), Curve 74747 (was 2867), 74747c04; Switch Right 75541 and Left 75542, each as `-f1` (straight) and `-f2` (branching) formations, and `c01` with the yellow lever 2866; Crossing 32087                     | As plastic; metal rails at ±50.5                                                                   |
| 4.5V / 12V              | Rails 3228a/b/c, 3229a/b, 3230a/b; complete straights 3228ac01, 3228bc01, 861c01, 3240ac01, 3240bc01; curves 3229ac01, 3229bc01, 866c01, 3241ac01; points 948/949 (4.5V), 73696/73697 and u9231–u9234 (12V); crossings 3231a/b, 992 | Origin at the rail tops, sleepers' undersides 24 below                                             |
| Flexible                | 64022 (straight), 64022c01/c02 (bent left/right)                                                                                                                                                                                    | Two halves hinged 5.625° apart ("radius 814.2 LDU at middle" in the file)                          |
| Other gauges            | 4-wide track 85976 (curve about 0/0/−480) and ramp 85977; roller coaster 25059, 25061, 26022, 26559–26561, 34738, 80562; Monorail 2670–2892; Duplo 6377, 6378, 6391, 51560                                                          | Not followed by Play                                                                               |

The official library has **no modern plastic switches** (the 7895 points of the RC/PF era) and no Powered Up or Power Functions train motor (88002 and later); only the motor's decorative side 2871b is there. The 9V switches share the plastic track's geometry, so they are the switches Play uses with plastic track, as layouts often do.

**Measured geometry.**

- **Gauge:** rail centres 100 LDU apart (5 studs), rail heads 6 LDU wide (z 47–53 either side).
- **Straight:** 320 LDU (16 studs) between its ends, which sit on its end sleepers at x = ±160. The rail joiners reach ±173.4 (plastic) or ±169 (9V) into the next piece.
- **Curve (R40):** radius 800 LDU (40 studs) to the centreline about (0, 0, −800) (the file's `!HELP The rotation point is at 0/0/-800`), 22.5° per piece (16 make a circle), the middle sleeper on the origin and the ends at (±156.072, −15.372), an arc of 314.16 LDU. Rails at radii 750 and 850.
- **9V switch:** common end at x = −320, straight end at x = +320 (two straights), diverging end at (333.853, ∓259.104) heading 22.5° away (right switch toward −Z, left toward +Z). The diverging route is two R40 arcs: 36.87° (sin 0.6) about (−320, −800), then 14.37° back about (640, 480); the rail heads of the switch lie 750 ± 3 and 850 ± 3 LDU from those centres. One more R40 curve turning back makes a parallel track 320 LDU (16 studs) over, level with the end of one more straight.
- **Wheels and bogies:** the Train Wheel Bogie 2878c01/c02 (a single axle holder with the 70720c01 wheelset, wheels 2879/57878 at x = ±50) stands 63 LDU from its top to the wheel treads; a Train Base 6 × 24 (92088, verified connectors) sits on it. Other rolling-stock parts: bases 6 × 24 (92340, 6584), 6 × 28 (92339, 4093a/b/c), 6 × 34 split level (2972, 87058), 6 × 16 (4178), Types 1/2 (270, 285, 303, 280, 736); bogies 38339c01/c02 with wheels 38340; RC wheels 55423; large drivers 85489a, 90840; motors 2894c01 (9V, with wheels), 579c01 (4.5V), 501ac01/501bc01/501cc01 (12V).
- **Couplers and buffers:** magnets 2959bc01 (73092 is obsolete), buffer beams with sealed magnets 64422, 64414, 91994, 29084, Train Coupling Types 1 and 2 (4023, 2920), hook couplings (737c01, 509c01, u9514c01, u9516c01, u9517), buffer beam 4022, single buffer 3488.
- **Bodies:** train fronts 2917 (with glass 2918), 2924ac01/bc01/bc02, 15536, 37493, 45706, 55768; train windows 4033/4035 (and c01 with glass), 6556; doors 4181/4182 with patterns, 42819, 43967; signals 4168/4169, level crossings 813 and 4512, speed regulator 2869c02, battery box car 3443.

The library holds parts, not models: there are no complete train sets in it. The sample is the repository's first train layout.

## Track graph

`src/play/track.ts` holds the centreline of each supported part (`TRACK_PARTS`): straights, R40 curves and 9V switches of the plastic, 9V and 4.5V/12V systems (21 parts; switches in all eight formations). A centreline is a chain of lines and circular arcs between the part's ends. Each end has a position at rail-top height and an outward direction. The test flattens every part through its subfiles and checks that the rail-head faces lie on rails 50 LDU either side of each route (at most 1% missing, 6% for a switch's frog and tongues) and that 95% (85% for switches) of rail-head vertices lie within 4.5 LDU of those rails. A switch with its diverging arcs bent to R 790 fails.

When Play starts, the included official track occurrences become a rail graph (`buildTrackGraph`). A placement must be upright (local Y world Y, rotation or mirror only; files round rotations, so it is snapped to the nearest exact turn). A mirrored right switch is a left switch. Two ends join when they meet within 3 LDU facing each other (within about 3°). Ends near another end that do not join are reported as **gaps** (distance and angle), and free ends as **dead ends** where trains stop. Track that is scaled, tilted or upside down is **skipped** with a reason.

## Trains

`deriveTrains` (`src/play/trains.ts`) finds the rolling stock:

1. **Wheels on the rails.** Parts from a pinned list of train wheels, bogies, wheeled bases and motors (`src/catalog/train-parts.ts`, 46 parts) whose box bottom is within 10 LDU of the rail tops and whose centre is within 64 LDU of a centreline.
2. **Cars.** Parts above the rails near the track (no lower than 10 LDU below the rail tops, within 200 LDU of a centreline) that touch are grouped, starting from the wheels. A coupling, magnet or buffer touching another never joins two cars into one body. Station platforms and buildings stand on the ground, below the rail tops, and never join.
3. **Bogies.** A car's wheel parts along the track within 40 LDU of each other form one bogie; the front and rear bogies are the car's pivots.
4. **Trains.** Cars whose ends are within 40 LDU are coupled. The car with a train front or a motor is the locomotive; it leads. A train needs its cars on one joined track.

Limits: 8 trains, 16 cars per train, 600 parts per car, 300,000 moving collision triangles for all trains. What is left out is listed in `snapshot().trains.skipped` with a reason.

## Running

Each fixed 60 Hz tick moves every train by its speed along its **route**, the chain of track it has run over and will run onto. Every bogie is placed on the centreline at its fixed distance behind the head (so couplings hold the cars' spacing), a car's frame runs through its front and rear bogie, and each bogie turns on its own pivot to the track's direction. On a curve a car's body cuts the corner between its bogies, as a real one does.

- **Speed:** throttle −1 to 1 of 480 LDU/s (24 studs a second), accelerating at 180 LDU/s² and braking at 360. Throttle 0 coasts to a stop; **Stop train** stops at once.
- **Points:** a train entering a switch from its common end follows the switch's route; one entering from the other end (trailing) throws it over to its own route (`trailed` in the report). Points are thrown by the contextual action (walk up to them: “Switch points to branch”) or the train controls, and are refused while a train covers them.
- **Stops:** at a dead end the train stops with its front at the end of the track (`end-of-track`). A train stops behind another (`blocked`). It waits while the walking explorer is in its way (`waiting`, “Waiting for you to step off the track”): each car is one trimesh collider in the walking world, inflated by how far it can move this tick, the test moving mechanisms use. Trains resume when the way is clear.
- **Collisions:** the explorer bumps into the cars and can stand on them (riding is not simulated: the train waits instead). In dynamic Play each car is a kinematic body, so a train pushes loose crates. Trains do not test the rest of the build: the track is assumed clear.
- **Determinism:** identical inputs and tick counts give identical reports (unit tests replay 900 ticks byte for byte, and rotated track gives the same run).

## Play controls

When the build has a train, a chip under the top row shows the train's status (“Train 1 · Running · 18 studs/s”) and **Go / Stop**, so one tap starts it from anywhere. Tapping the status opens a drawer with the rest: **Reverse** and a speed slider, then **Ride along**, **Horn** (a short synthesized two-tone horn), a **Points** key per switch (up to two, labelled with their route) and, with several trains, **Next train**. On a desktop, where Play captures the mouse for look, the train has keys: **G** go/stop, **R** reverse, **C** ride along, **H** horn and **P** the first points (shown on the buttons; a key the player has bound to another Play action keeps that action). Every control is at least 44 px. The chip hides while the game is paused, in a vehicle or with the remote mechanism panel open; the centred message and start hint move below it, and the start hint gives way to an open drawer.

**Drive train.** Walk up beside the locomotive (within 150 LDU of it) and the contextual action becomes **Drive train** (E on a desktop): it rides along in the cab and opens the drawer. While riding, the joystick and the Jump and Run keys step aside (walking input is ignored), and the action becomes **Get off train** (E, or C).

**Ride along** puts the camera on the train: third person is a chase view behind the locomotive that the look drag orbits, turning with the train; first person is the cab. The explorer waits where they stood and walking input is ignored until the ride ends.

Screenshots from the browser tests: [chase view on a desktop](screenshots/trains/desktop-chase.png), [the cab](screenshots/trains/desktop-cab.png) and [a phone held sideways](screenshots/trains/phone-landscape.png).

## Editor: track snaps end to end

A track part placed near a free rail end of the placed track (within 240 LDU of the tap) is offered at every way one of its own ends meets that end (`src/edit/track-snap.ts`): a straight once (either way round is the same), a curve bending either way, a switch from each of its three ends. **Next fit** or **Rotate** cycles them; nearest end first; nothing is offered that would lie along existing track. With **Snap together** on, a track piece joined to the track holds by its rails (“Joins the track.”), and track and wheels are exempt from the clash test with track (pieces interlock at their ends; wheels run inside the rail heads). `connectors.orient({ part, point, normal })` returns these fits with `mode: "track"`.

Model health and the template build checks treat rolling stock as standing on its wheels (set aside from the connection groups: “3 rail vehicles stand on their wheels on the track”), and do not count joined track or wheels on rails as overlaps. Track curves and rail vehicles are off the stud grid by design.

## Automation and CLI

```ts
await api.play.enter({ realtime: false }); // trains: true by default
let s = await api.play.setTrainThrottle({ throttle: 1 }); // or { trainId, throttle }
s = await api.play.stepTicks(600);
s.trains.trains[0]; // { id, name, cars, throttle, speed, status, reason?, odometer, position, heading, pieces }
s.trains.switches; // [{ occurrenceId, part, route: "straight" | "branch", occupied, trailed?, position }]
await api.play.setPoints({
  occurrenceId: s.trains.switches[0].occurrenceId,
  route: "branch",
});
await api.play.rideTrain({}); // { trainId: null } ends the ride
await api.play.stopTrain({});
```

`play.enter({ trains: false })` leaves the rolling stock static. `snapshot().trains.track` reports the pieces, gaps, dead ends and skipped track. `exportPosedModel` includes the cars where they stand. CLI: `brick-cli play --input layout.mpd --train-throttle 1 --ticks 600 --output play.png --report play.json`; `--points '[{"occurrenceId":"…","route":"branch"}]'`, `--ride-train` and `--no-trains` ([CLI](CLI.md)).

## Not implemented

Coupling and uncoupling in Play (cars coupled at the start stay coupled; a train that runs into parked cars stops behind them), riding on a train as a walking figure, sloped track and ramps, crossings, flexible track, 4-wide, roller coaster and monorail track, the 4.5V/12V points, turntables, signals and level crossings that react to trains, wheel spin and connecting rods, sound beyond the horn, and trains testing the rest of the build for collisions. The modern plastic switches and Powered Up motors are not in the official library.
