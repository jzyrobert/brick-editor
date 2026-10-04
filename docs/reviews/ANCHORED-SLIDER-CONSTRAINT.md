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
All four tests pass. The existing seven `play-dynamics` tests also pass.
TypeScript, focused formatting and diff checks pass. The separate preexisting
loop validation assertion still expects a cycle error after changing a layered
fixture's parent without updating its rest anchor; validation instead rejects
the inconsistent rest anchor before native construction.
