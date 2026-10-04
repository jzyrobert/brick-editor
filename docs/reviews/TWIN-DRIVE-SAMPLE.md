# Twin motor table: original connected source arrangement

`src/mechanisms/twin-drive-fixture.ts` supplies an original CC0 arrangement of
35 actual official parts. It references the pinned LDraw library without copying
or changing the licensed motor, gear or structural geometry. The existing
Power Functions M source review and mechanical part profiles supply every
moving interface; this sample adds no contact allowance or resource exception.

One shared 6×16 plate carries both lane bases. Each base holds the bearing
supports and motor foot through real top studs. The PF-M cases sit on their
reviewed underside anti-studs. Each local +Z output socket engages a six-stud
axle by 10 LDU, leaving the blind back at 20 LDU clear. The case stays fixed.

All five shafts pass through two actual Technic brick bores at Z −20/+20.
Their outside collars at Z −35/+35 seat against the outer mouths at Z −30/+30.
Each keyed gear hub is captured between the inside bearing mouths at Z −10/+10.
The slight source hub difference of the 24-tooth gear uses the existing reviewed
seating tolerance. These are ideal simulation interfaces, not measured hardware
load, motor torque, collar grip or clutch-strength ratings.

The red train has 8-, 8- and 24-tooth gears at X 0/20/60, with source rest phases
0°/22.5°/0°. Two actual meshes give a final output at one third of the input
speed, in the same direction. The blue train has two 8-tooth gears at X 160/180,
with phases 0°/22.5°; its output turns at the input speed in the opposite
direction. Both PF-M cases retain their own independent powered components.

Canonical source proposals contain one rig (`twin-drive`), one connected fixed
frame with 15 members, five shaft groups and three transmissions. Motor controls
are `joint-0` (red; output `joint-2`) and `joint-3` (blue; output `joint-4`).
The complete ordinary Play source-admission check accepts the arrangement and
refuses it when the shared frame plate is disconnected.

The source-derived moving compounds use **2,737 convex children**, within the
unchanged 4,096-child session cap. Ordinary fixed surfaces retain their source
triangle budget. Focused native/kinematic checks cover simultaneous proportional
speed, independent reversal/braking, signed transmission relations, a foreign
red-output obstruction while blue continues, and recovery after its removal.
The native two-stage constraint needs up to six simulated seconds to settle at
the blocker. Every check preserves source placements and parts inventory.
These bounded VM checks are not physical phone throughput measurements.

The product template retains the source red/blue colors, offers one whole-rig
overview and a short Controls hint. The template generator renders its actual
source geometry for the chooser image. Schema, source MPD, preview and offline
dependency regeneration are performed by their existing scripts on integration.
