# Native sliders on anchored carriers

An authored prismatic joint fixes the child's orientation relative to its
carrier. When that carrier is anchored, all three child rotations are already
forbidden in world space. Play now also locks those body rotations in Rapier.
This realizes the existing degrees of freedom directly; it does not write body
poses, change mass or motor effort, or exclude contacts. Sliders on moving
carriers keep their native relative joint constraint and can turn with them.

The corrected rack contact experiment exposed native rotational drift when
only the rack's translations were obstructed. Eight additional solver
iterations alone reached 3.084 LDU transverse drift and 5.948 degrees rotation;
the guide's alignment guard correctly restored contacts, after which retry
failed. The redundant anchored-body rotation lock kept the unchanged-mass rack
at about 0.199 degrees input while obstructed and reached its physical lower
slider limit after release. This remains private rack diagnostic evidence;
complete rack proxy/contact acceptance is separate and remains open.

`tests/unit/play-anchored-prismatic.test.ts` verifies actual native obstruction
and retry for straight and 37-degree oblique authored frames, a foreign blocker
that still responds until removed, and retained rotation of a mobile carrier.
All four tests pass. Parent integration passes all 46 focused cases across
anchored sliders, existing dynamics, moving platforms, grippers, native loop
constraints and all six kinematic loop checks. TypeScript and full formatting
pass. The production build passes in 43.65 seconds; the rendered dynamic lift
and offline Technic reload checks both pass in 54.7 seconds. Rapier remains only
in the lazy Play bundle. Private parent logs:
`.local/anchored-slider-integration-{units,types,build,browser,format}.log`.
The owned port 4397 preview is stopped.

Centered compound children also compose their positions through the authored
frame, alongside their orientations. Previously the native constructor rotated
only child orientations; nonzero child centers could remain on the unrotated
axis. An added 37° oblique regression verifies actual native and walking-mirror
containment at the posed center and rejects the old unrotated center.
The final parent integration passes all **47 cases in 44.56 seconds**. A fresh
production build, including TypeScript, passes in **36.63 seconds**; both the
Dynamic lift and offline Technic reload checks pass in **39.9 seconds**. WASM
remains confined to lazy `session-vZSJO0zJ.js` (4,483,783 bytes). Generated files
are unchanged and port 4397 is stopped. Final logs:
`.local/centred-slider-integration-{units,build,browser}.log`.
