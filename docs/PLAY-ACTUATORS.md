# Authored springs, ropes and movable bearings

> **Engineering scope:** these mathematical/native fixtures remain available for
> engine verification and lossless project storage. Ordinary Play requires real,
> reviewed part connections and currently refuses these unbound mechanisms.
> See [physical Play admission](PLAY-PHYSICS.md#physical-parts-in-ordinary-play).

Dynamic Play accepts optional `rig.forceLinks`, independently of the mount tree.
Each link declares unique `id`, two distinct bodies, and group-local `anchorA`
and `anchorB`. Up to 32 links can connect a rig's existing rigid bodies. They do
not create new inventory parts or automatically recognize shock absorbers,
ropes, actuators or their attachment points.

A spring uses `kind:"spring"`, `restLengthLdu` (0–10,000),
`stiffnessNewtonsPerMetre` (0.001–1,000,000) and
`dampingNewtonsSecondsPerMetre` (0–100,000). Native spring constraints oppose
extension and compression and damp relative attachment motion. A prismatic
mount joint can guide a spring to make a bounded shock or linear spring actuator.
Its travel stops remain ordinary authored joint limits. Linear position control
uses bounded force-based velocity feedback to hold its target against gravity
and spring loads, with the requested speed and authored effort retained.

A rope uses `kind:"rope"` and `maxLengthLdu` (0.01–10,000). Its authored attachment
distance must not already exceed the length. The native rope constraint leaves
shorter distances slack and limits further separation when taut. It supplies no
compression force. Changing rope length, winches, routed pulleys and a deforming
visual cable are not implemented.

Lengths convert at the declared 0.02 metres/LDU gameplay scale. Spring stiffness
and damping use simulation N/m and N·s/m. These values do not claim measured
miniature LEGO hardware behavior. Root groups remain anchored by default;
explicitly set `dynamics.groups[bodyId].anchored:false` for a free linked body.
A force link alone does not declare a rigid attachment or intentional bearing
contact.

## Spherical angular resistance

A spherical joint can declare
`angularResistance:{maxTorqueNm,dampingNmSeconds}`. Bounds are 0–1,000,000 N·m
and 0–100,000 N·m·s. Three native angular velocity motors oppose rotation with
force-based damping. Each axis is capped at the total torque bound divided by
three, so the sum of axis efforts cannot exceed the declared cap. Zero resistance
keeps the existing freely rotating ball joint behavior.

Rapier 0.21 returns a `GenericImpulseJoint` wrapper for spherical joint data.
Its exported `SphericalImpulseJoint` constructor accepts the existing public
joint handle, body set and joint set, and exposes the supported angular-axis
motor operations. The adapter uses this public constructor; it does not cast a
Generic object and call nonexistent methods, alter the engine, or use private
WASM entry points. A pinned-engine test verifies actual resisted rotation.

Powered orientation targets, swing/twist limits, detents and a multi-axis pose
editor remain open. Angular resistance is simulation damping/torque resistance,
not a position lock or a measured part-specific friction profile.

## Cylindrical bearings

A mount joint with `kind:"cylindrical"` declares coincident local anchors and
matching unit `axisA`/`axisB`. It allows translation along that axis and free
rotation around it while constraining radial translation and tilt. Optional
`translationLimitsLdu:[lower,upper]` stops enclose the authored zero and remain
within ±10,000 LDU. Omitting them leaves axial travel free.

The native generic joint locks the other four axes. The pinned engine's public
prismatic wrapper applies axial stops to its linear axis. Dynamic reports expose
read-only `dynamics.bearings[jointId].translationLdu` and accumulated
`angleDegrees`. Turns unwrap adjacent fixed-tick orientations; spin above 180°
per tick can alias the accumulated reading. Actual transformed bodies drive posed
exports. A cylindrical
bearing has two freedoms: scalar joint targets, motors and ordinary `limits` are
refused. The current scalar editor cannot edit this definition without losing
information, so use a complete rig through the API/native project.

Kinematic preview retains both axial and rotational rest placements and warns
that free bearing motion requires Dynamic. Cylindrical edges cannot participate
in the current planar kinematic closure solver. This slice does not automatically
recognize an unretained axle, provide spin/translation motor controls, model
bearing friction, or animate a complete actuator's internal inventory components.

## Preview, persistence and limits

Paused/kinematic preview retains authored placements and warns that forces and
rope tension require Dynamic Play. It does not simulate a spring or silently
apply a rope length constraint. Dynamic reports expose actual body/group frames,
velocities and existing posed export; no unmeasured tension value is invented.
Native projects preserve these definitions. The simple joint authoring form
refuses rigs it would flatten or discard; Physics settings can still edit the
whole rig's existing dynamics data.

Source/inventory preservation, loaded spring extension, impulse damping,
rope slack/catch/shortening and ball resistance are verified in the pinned
engine. The force-link acceptance uses original fixture bodies, not automatic
articulation of complete official shock/actuator assemblies. See
[verification](VERIFICATION.md#springs-ropes-and-ball-resistance-3-october-2026).
