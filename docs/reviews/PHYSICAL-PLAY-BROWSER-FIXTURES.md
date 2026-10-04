# Browser fixtures follow real physical connections

Ordinary BrowserPlay no longer treats mathematical joint coordinates or a motor
setting as proof of a LEGO connection or motor. The engineering fixtures remain
losslessly importable, editable and covered by their direct engine unit tests.
Browser checks now distinguish their refusal from usable product motion.

The gripper, gripper integration, four-bar/slider-crank, twin-loop steering,
spring/rope, linear actuator, cylindrical bearing, project override and synthetic
platform suites exercise ordinary API entry refusal. They check the specific
missing physical capability, then enter the same source as a static world with
no selected rigs. Query, authored rigs, LDraw source, inventory and every native
archive member remain unchanged. Native ZIP container timestamps are excluded;
the exported file contents are compared exactly. Jeep driving and seating cases
in the platform suite are retained.

No test-only product entry bypass or new mechanical recognition is introduced.
The project-defined part named `3648b.dat` continues to be project geometry; it
cannot borrow a motor or physical connection from the official part's name.

## Retained controls and physical browser fixtures

The retained product cases use the actual seated `60596`/`60616a` door, the
repository roadster with its source wheels and driver seat, and the mounted
Power Functions M motor fixture. Two-motor controls use two independent mounted
assemblies rather than treating distant parts as a single connected frame. The
optional `3010` loose brick rests on the ground and declares an unanchored 1 kg
test body; this is a controlled physics fixture, not a LEGO weight claim.

The roadster is translated to Z=-320, with source nodes, rest transforms and
all group frames translated together. At Z=-200 its actual geometry correctly
stopped the door at 51 degrees; the separated arrangement reaches the unchanged
90-degree target. Driving approaches use the source driver-seat stand, and
on-foot driving uses the real seat's **Drive from here** action. Door passage
walks through the centre over the real frame sill; a ground-height teleport into
that sill remains refused. Atomic actor-crossing closure, bounded animated
closure, frozen capture and clear-and-retry retain distinct assertions.

Seven original desktop/portrait/landscape control viewports retain held-input,
release/blur, pause, orbit/whole-build framing and touch-target checks. The
mounted motor runs to 765 degrees with output -255, then reverses through the
passive output to 270 with input -810, in both Kinematic and Dynamic modes.
Project/query state, source, inventory and native archive contents remain exact.
These cases replace synthetic browser motion; direct engine benches remain.
Explicit fixed ticks complete UI targets without asserting SwiftShader's
realtime frame rate. No collision guard, resource cap or physics default changes.

The scoped functional checks passed across their relevant dependency checkpoints:
seven control viewports; four independent-motor controls; import race; three
all-mechanism sizes; four nearby/frozen interactions; two posed-door/touch
cases; four multi-rig/capture cases; and four door-room/loose-brick cases.
Both mounted transmission cases also passed. The final three unresolved door
cases were checked against the strict source-seating production build.

The performance fixture now measures this actual door/roadster arrangement,
plus the actual automatic door room, rather than synthetic powered rigs. The
unchanged Dynamic mean limits (desktop <4 ms, phone-profile <10 ms) pass:
2.001 ms desktop and 5.699 ms with mobile profile/4x CPU throttling. Kinematic
means were 7.009/30.091 ms; automatic-door means were 3.694/12.927 ms. These are
shared ARM VM/Chromium SwiftShader measurements, not physical-phone or 60 Hz
certificates. Slower source-geometry paths remain optimization opportunities.
