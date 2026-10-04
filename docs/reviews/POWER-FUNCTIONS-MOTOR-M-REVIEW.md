# Power Functions M motor: reviewed physical binding

The first supported powered mechanism uses the actual pinned official
`58120.dat` **Electric Power Functions Medium Motor**. Its stationary case,
rotating output hub, mounts and inserted axle remain actual parts; an arbitrary
motor setting cannot replace them. This review uses the committed complete
LDraw pack only. No geometry was crawled, invented, or copied from another tool.

## Source evidence and licence

The complete pack is `ldraw-full-2026-09-28`, manifest SHA-256
`93042f4a636a15655f350c5309bb14086ad53e9df0654b3c2d0af32bfd799ce7`.
The assembly is Philippe Hurbain's official CC BY 4.0 shortcut. The output hub
is Guy Vivan's official CC BY 2.0 / CC BY 4.0 part; all source headers stay
unmodified in the existing pinned pack. See [LDraw notices](../../public/notices/LDRAW.txt).

| Reference                        | SHA-256                                                          |
| -------------------------------- | ---------------------------------------------------------------- |
| 58120.dat, complete motor        | d5b603cbff5e6a00038c0970c4155ab12567c55f599a201c1f00e75fa9ed047f |
| 59143.dat, stationary front/case | 1e2c6a56976063153b3c0bee81d42dc26c4c8eca90fa1bd2bfe81890116c7e09 |
| 59142.dat, stationary rear       | 587926ba9276d9c82ae1cba3a7187cf0e843cd63f0b1bec8445c5c4e67952262 |
| 47157.dat, rotating axle bush    | 442502a2866aca7ada8216d00f658c0fd60c0a5beded0564184d1d10e87ecfca |
| axlehole.dat                     | 8dfcdd5058a66fba2ea4f59ddc7fd4510118baca9f745e5dfe341ccf0e24b49e |
| axlehol2.dat                     | 9d3e161068b049c3a21fbb8c0970d8264215c08bfcefd3508b8bbff47974a319 |
| axl5end.dat, closed back         | bcfcb15a7ed768ff4c6746f5ed319c8a6d92d0e720b51e9fd973391987403af2 |

`58120.dat` places `59143.dat` and `47157.dat` at its origin, and the rear
`59142.dat` at local Z=120. The shaft axis is local +Z. The hub calls
`axlehole.dat` from Z=0 through Z=20, `axlehol2.dat` on its front/back ends,
and closes the back with `axl5end.dat` at Z=20. Its outer envelope is radius
9 and Z=0..22. An independent ray through the actual compiled hub enters the
open socket and first hits Z=20; a ray at X=7 hits its front ring at Z=0.
The cross key is aligned with local X/Y, and quarter-turn phases are equivalent.

The case's four front round pin holes lie at X/Y=±20, local Z=0..20 with
core Z=2..18. Its twelve underside anti-stud positions are Y=30, X=±10 and
Z=10,30,50,70,90,110. This specific manual review does not upgrade generic
connector coverage: the general extractor flags the curved casing's bottom as
off the four-LDU grid. The motor's central socket is **not** an ordinary keyed
hole on the fixed case: treating it that way would rigidly weld the rotor to
the stationary casing.

## Physically connected gearbox

`physicalMotorFixture()` builds an original fifteen-part assembly:

- PF-M motor at [0,−46,50]; its +Z socket ends at Z=70.
- Real 3706 six-stud input axle centred at [0,−46,0], aligned along Z, ends
  at Z=60. It inserts 10 LDU, leaving 10 LDU before the closed back. The last
  2.5 LDU of the real axle is bevelled; 7.5 LDU has the full keyed section.
- Original reviewed 8:24 gears, two 3701 bearings at [20,−56,±20], and seated
  4265a retainers at Z=±35. The positive retainer ends at Z=40, clear of the
  motor front at Z=50. The 24-tooth output axle stays independent of the case.
- Real 3795 Plate 2 × 6 at [0,−16,110], rotated Y=90°, mates all twelve
  motor anti-studs. Real 3030 Plate 4 × 10 at [20,−8,70], rotated Y=90°,
  connects that plate to two 3010 Brick 1 × 4 supports at [20,−32,±20],
  which connect to the bearing bricks. The common base bottom is Y=0.

The binding checker requires a reviewed official source, physical transforms,
case membership in the joint's carrier, a collinear reviewed axle in the
rotating group, correct keyed phase, at least 7.5 LDU insertion and no crossing
of the closed back. It also requires actual underside stud contacts and a
stud-connected path from the motor mount to every supporting shaft bearing.
Putting disconnected pieces into the same authored group does not satisfy it.
Translated and rotated carriers remain supported. Motor/body geometry and
source transforms are preserved; simulation effort is a gameplay value, not a
claim about real motor power or brick clutch strength.

## Scope

The source says the stationary case's internal motor gears are not modelled.
This review admits the observable output shaft/socket and mounting interface;
it does not infer invisible gear ratios, electrical wiring, battery behavior,
real clutch torque, every motor family, or arbitrary socket penetration.
The full source and actual captured geometry still govern collision admission.
Developer custom-box fixtures remain useful engine tests, but are not product
mechanism samples or substitute motor parts.
