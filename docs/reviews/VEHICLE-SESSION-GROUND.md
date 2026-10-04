# Temporary ground for imported vehicles

The original 6503 and 31027 car assemblies place their wheel centres at source
Y=5. Their tyres extend to Y=23 and Y=24 respectively. The previous temporary
plane at Y=0 cut through these unchanged imports, so protected driving refused
every attempted move before reaching any real obstacle.

A session with a supported, completely compiled vehicle now chooses one
immutable temporary ground height. In source coordinates it is the maximum of
zero, the included collision vertices, every active source group's vertices,
and the certified driving and existing reviewed wheel-radius envelopes. Broad
diagnostic bounds do not determine it. Unsupported vehicle profiles do not
choose a new plane; coordinates outside the existing driving query domain
retain the previous ground instead of creating an unbounded native plane.

The walking world, dynamic world, vehicle checks and seated body transfers use
the same plane. Normal safe spawning finds its supporting surface. Existing
source floors, walls and foreign bodies keep their full collision response;
the temporary plane is merely beneath the included geometry. No part, rest
transform, tyre radius, collision tolerance or physics default is changed.
Nonvehicle sessions retain Y=0, and `ground:false` still removes temporary
ground.

This does not snap a car to terrain or supply kinematic suspension. Vehicles
retain their authored rest height, and native vehicles retain their existing
ray-cast suspension. Multiple source support heights can leave a kinematic
vehicle above the shared temporary plane; real authored surfaces remain the
appropriate support in such scenes.

Focused coverage in `tests/unit/play-vehicle-session-ground.test.ts` uses the
attributed, unchanged official car excerpts in both native and kinematic Play,
including source/inventory preservation, wheel support, walking and disabled
ground. It also checks the existing Roadster and Jeep ground, refuses to lower
ground for an unsupported wheel axis, and retains a real floor and a thin
foreign-wall obstruction/reverse retry above the lowered temporary plane.
