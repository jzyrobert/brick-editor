# Reviewed mechanical features and rig proposals

The first mechanical feature pack separates connection freedom from generic
adjacency. `mechanisms.propose()` produces a reviewable rig draft without editing
the project, changing inventory or entering Play. Fixed frame anchors are
explicit. The existing `rigs.upsert` command saves a reviewed draft, and existing
mechanism/Play controls can then move its joints. Direct session-only Play entry
from a proposal and a proposal authoring UI remain open.

## Source review

[mechanical-pack.ts](../src/mechanisms/mechanical-pack.ts) binds its profiles to
both shipped source manifest hashes and each part's exact source hash. Manifest
pinning includes subparts/primitives; a source pack update disables the profiles
until reviewed. No library geometry is modified, and no proprietary/shadow data
is used. Existing catalogue connector coverage is not upgraded by this pack.

| Profiles         | Reviewed features                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| 3700, 3701, 3702 | Round through bores: axes, bearing intervals, mouth faces and radius from peghole/cylinder placements |
| 3673, 2780       | Separate pin halves, collar/lip seating intervals, plain versus frictional rotation                   |
| 3705, 3706, 3707 | Axle intervals, cross-section phase and axis                                                          |
| 3713, 4265a      | Keyed collars with ideal axial grip and stop flanges                                                  |
| 3647, 3648b      | Keyed centre bores; 8/24 tooth counts, face intervals and tooth phase; nominal module 2.5 LDU         |
| 3743             | Rack travel axis, tooth-facing normal and pitch plane; mesh pitch 8 LDU                               |
| 4275b, 4276b     | Complementary three/two-finger pivots and axes; explicitly reviewed top studs                         |

These are ideal simulation interfaces, not measured snap-fit, pin-friction or
clutch-power guarantees. Gear pitch radii are 10 and 30 LDU for the reviewed
spur pair. The rack's polygonal 8-LDU tooth spacing approximates the nominal
module's circular pitch; a later rack controller must document that distinction.
Peripheral holes of the 24-tooth gear, aliases and complete assemblies are not
reviewed in this slice.

## Contact and proposal rules

[mechanical-contacts.ts](../src/mechanisms/mechanical-contacts.ts) transforms
features into world space while preserving source placements. LDraw's rounded
proper rotations use exact feature frames; mirrors/scales and embedded custom
copies are excluded. A bounded spatial index checks actual axial overlap,
collinearity, cross-section phase, complete bearing engagement and seated pin
intervals. A gear candidate requires compatible axes/module, pitch-centre
separation, tooth-face overlap and staggered teeth at the authored rest pose.

The graph keeps these contacts separate:

- `stud-weld`: verified stud/antistud attachment, including reviewed hinge studs.
- `bearing`: free rotation and axial travel on a round bore.
- `keyed-slide`: rotation locked, axial travel retained unless it is a gripping collar.
- `pin-bearing`: free or frictional rotation; seated retention reported separately.
- `finger-hinge`: complementary, coincident finger halves.
- `spur-mesh`: signed ratio and tooth counts, without an invented rigid attachment.

[mechanical-proposals.ts](../src/mechanisms/mechanical-proposals.ts) reduces
multiple coaxial frame bearings to one shaft joint only when collar stops restrain
both ends. Each keyed accessory must also be captured between neighboring axial
faces. A missing stop, incompatible engagement or several possible shafts refuses
that moving assembly. Pin proposals retain a separate pin body with frame→pin
and pin→arm revolute joints. Friction pins are never silently welded. Ordinary
finger hinges recruit their stud-attached accessories into the moving group.
Several articulations of the same arm remain unresolved rather than discarding
a closing constraint. Authored rig ownership always wins.

The core acceptance arrangement produces a fixed frame, two retained shaft
groups, a separate pin and arm, four joints and an 8:24 relation candidate with
ratio −1/3 for matching axis signs. The pair is **not yet coupled**: the next
transmission layer must drive the output from the input and carry reaction load
in Dynamic. The current preview moves each independent joint explicitly.

## Bounds and verification

Analysis accepts at most 2,048 selected occurrences, 8,192 features/stud points,
100,000 spatial entries, 200,000 candidate-pair checks and 8,192 emitted contacts
plus rejections. Exhaustion fails the whole analysis, so partial searches cannot
appear uniquely matched. Existing rig and Play budgets still apply to use of the
result. Geometry and connector assets use existing same-origin verified loaders
and offline caches; the analysis module is lazy-loaded. No new runtime asset or
dependency is added.

See [verification](VERIFICATION.md#reviewed-mechanical-proposals-3-october-2026)
for the exact test and rendered scope. A broader automatic Technic authoring UI,
gear/rack simulation, collision policy, closed linkages and other actuators remain
in the [motion roadmap](PLAY-MOTION-ROADMAP.md).
