# Closed planar linkages

Authored rigs can retain their acyclic mount tree and add explicit
`loopClosures`. A closure joins two bodies in that tree with a revolute bearing;
it is not traversed as a parent edge. The first verified arrangements are the
original four-bar and slider-crank fixtures in `fixtures/ldraw/`.

A closure declares `id`, `kind:"revolute"`, `bodyA`, `bodyB`, `anchorA`, `anchorB`,
`axisA`, `axisB` and `dependentJointIds`. Anchors and unit axes are group-local.
The dependent IDs name passive revolute/prismatic tree coordinates on the path
between the two bodies. They cannot have motors or transmission relations, and
manual targets/positions for them are refused. Drive an independent coordinate;
reports still expose the passive positions and all actual group frames.

## Validation and bounded solving

The ordinary joint graph remains a forest. Closures require the same tree,
coincident authored anchors, agreeing axes, planar hinge axes and in-plane slider
travel. Repeated closure body pairs are refused as redundant constraints. The
rig can have at most eight closures and sixteen distinct passive coordinates;
vehicle rigs cannot also declare these closures.

Kinematic preview and Play use damped least-squares continuation on the declared
passive coordinates. Each independent command is subdivided into at most 1,024
segments of at most 2° or 2 LDU. Each segment allows at most 48 iterations; dense
systems have at most sixteen coordinates. Successful poses close every anchor
within 0.001 LDU and retain the input exactly. Authored limits apply to every
passive coordinate. Failure preserves the whole previous pose. Play motor
failure reports `blocked`; it does not drop a closure to keep moving.

Continuation remembers the selected assembly branch. The tested four-bar passes
its 90° and 270° toggle positions in both directions with a known motion path.
Starting cold at either straight toggle has an ambiguous continuation branch and
is refused until the pose is moved away from the toggle. A whole supplied pose
must already close every loop; `setPose` does not silently repair it. Swept Play
interpolation re-solves passive coordinates, so it does not linearly open a loop
between valid endpoint poses.

## Dynamic behavior

Dynamic Play creates all mount joints **and** real native closure joints.
Constraint reaction passes through the linkage to the effort-limited driver.
Passive coordinates have no artificial idle motors. Closed-linkage velocity
motors use force-based damping so a small crank can drive the reflected inertia
of its connected bodies; the authored effort cap still applies. Articulated
islands retain the existing eight additional native solver iterations.

Dynamic motion never solves or assigns body poses to enforce closure. Native
contacts, limits and forces determine the frames. The verified four-bar and
slider-crank each keep their attachment error below 0.08 LDU during repeated
turns on an oblique world axis. A fixed output stalls the sole motor and motion
recovers when that body is released. Passive travel limits prevent a requested
45° motion and produce `blocked`, with closure intact.

## Persistence and scope

The optional data is backwards compatible with motion-rig schema version 1.
Native save/restore retains it. Explicit posed application rebases local anchors
and rest frames, and undo restores the original rig. Play and preview preserve
authored placements, source export and inventory. Posed export is a plain static
copy with the same four fixture occurrences.

This establishes these planar examples and bounded failure behavior. It does not
establish arbitrary spatial loop solving, automatic linkage recognition,
branch selection from a cold singular pose, general internal contact safety,
a compound-rig authoring interface or physical-phone performance. Authored [springs, ropes and ball resistance](PLAY-ACTUATORS.md) are
a separate verified extension. Ball orientation limits, cylindrical joints and
other actuators remain open. See [verification](VERIFICATION.md#closed-planar-linkages-3-october-2026).
