# Retained crane winch: source witness and native baseline

The source-derived native subsystem now has forward/reverse, load/stall,
backdrive and foreign-contact evidence. Ordinary Play admission and complete
crane operation remain open. It complements [the drivetrain source review](TECHNIC-DRIVETRAIN-INTERFACES.md)
and [the native angular kernel review](TECHNIC-ANGULAR-EQUATIONS.md).

The attributed 12-member excerpt in
`fixtures/ldraw/technic/42042-retained-winch.ldr` derives from Philippe Hurbain's
[public 42042 OMR source](https://library.ldraw.org/library/omr/42042-1.mpd),
SHA256 `d9c3aa6e0351fd7bcc352e817dafd2c095d4192d7f691ddbb7c5eece03d7237b`,
original lines 12085–12097. It preserves composed source frames, using test
colour 71. Full original geometry, ropes, pulleys and neighbouring supports
remain private and are outside this excerpt's acceptance scope. Installed
official part headers remain unchanged.

`bindRetainedWinchSources` verifies the seven full pinned source dependency
closures in `winch-sources.json`, including the actual project's dependency
shadows. `retainedWinch` requires all 12 official occurrences in their literal
source seats; missing, displaced, duplicate or project-defined substitute
members refuse. The witness is sealed and separates eight carrier members,
two input members and two output members. A common world rotation preserves
the source seats and the derived signed 1:8 worm ratio.

The literal interfaces are:

- Four 32449 thin beams have keyed Y bores at local Z ±30 and a round Y bore at
  Z 10. Their faces lie at Y ±5. Two 87083 cross axles pass through those keyed
  end bores and the keyed X bores of two 6536 cross-blocks.
- Each 6536 has its round Z bore at local Y 20 with faces Z ±10. In the actual
  winch these bores lie along the 4716 input axis at stations −30 and+30; their
  inner faces capture the worm's original shoulders at −20 and +20.
- The10928 original faces at axis stations−10 and+10 meet the inner beam
  faces. Its keyed bore receives the 3737 axle. The4716 keyed bore receives
  the 15462 stop axle. These are distinct rotating source members, rather than
  a motor casing or a whole submodel rotated as one body.
- Independent compiled source rays measure R6 round carrier cores and
  material on the worm/gear caps at radius 7, outside those cores. The witness
  names ten real keyed carrier edges and the two capture intervals. It does
  not certify all-angle tooth clearance, material properties, frictional
  locking, or an external attachment of this carrier to the complete crane.

The two shoulder captures retain 4716 and 10928, **not both shafts**. The plain
3737 cross axle has no opposing collars in this excerpt. The 15462 source has
one R8 stop at local X 48–50 (worm-relative axial stations 38–40), but opposing
shaft restraint has not been proved. The native subsystem combines each keyed
shaft and its worm/gear using a declared ideal axial grip. Rotational keying
alone does not justify that rigid ownership. Ordinary Play must explicitly
review that ideal grip, prove additional source retention, or retain axial
shaft freedom; the sealed member lists do not authorize a weld by themselves.

Focused source checks cover all required members, source immutability,
an oblique common world transform, floating/missing/duplicate supports,
dependency mutation and embedded primitive shadows. Reproduce them with:

```sh
FORCE_COLOR=0 npx vitest run tests/unit/retained-winch.test.ts --maxWorkers=1
```

The private baseline `.local/winch-runtime/probe.ts` compiles the actual
member meshes with the renderer source helper and constructs native bodies
at the source pivots: eight fixed carrier parts, 4716+15462 input and
10928+3737 output, with actual revolute axes and the signed angular equation.
Every source triangle remains present; twelve native TriMesh colliders contain
8,660 triangles in total. No pair exclusions or collision-group suppression
are applied. With ideal declared mass 0.05kg per member, zero gravity and
0.002Nm input torque for 300 ticks at 60Hz, the input moves only 0.000273rad
and the output approximately −0.000000946rad. Thus this baseline stalls;
native source surfaces plus the angular equation alone do not establish a
working collision realization. These numbers describe an exploratory
TriMesh diagnostic, not the production convex-solid model or a measured
LEGO torque specification.

## Native source-derived candidate

`winch-convex.ts` constructs 132 convex cells for4716 and 96 for10928.
The worm's literal thread sectors use their original lower/upper flank
diagonals, lead8, crest width2 and source end planes±20. Each sector is convex;
it does not bridge the thread valleys. The core is an annular extrusion around
the actual24-sided concave rounded keyed hole. The wheel preserves its literal
root cylinder and eight source tooth nose/base/root profiles, including the
authored`.707` internal transforms. It splits the unchanged root annulus at
radius7 to keep the keyed hub separate from the outer tooth-contact band.
No source positive width/height/volume cutoff, whole-part hull, scale or padding
is used. End-plane-only supports already belong to neighbouring retained caps.

Authored worm flank and helical-cylinder decimals have small alternatives:
root coordinate changes are at most0.000141422LDU and the scaled crest
alternatives differ by at most0.000326LDU. The declared source normal-plane
envelope is0.00035LDU. Independent finite polygon subtraction clips **every
point of every actual source triangle** against the expanded candidate-cell
union: all836 worm and544 wheel triangles leave zero residual area, with an
explicit floating clipping scope below1e−14LDU² per fragment. This is stronger
than vertex sampling. Maximum unexpanded source-vertex plane excess is
0.000292217704LDU for the worm and0.000000361278LDU for the wheel.

The0.00035 number is a source-face normal-plane envelope, not a boundary
Hausdorff theorem or complete source-solid/topology proof. Native F32 point,
body-pose and integration rounding are additional. Finite clipping of every
complete candidate convex projection against a triangulation of the actual
24-sided keyed-hole polygon gives total intersection area below1e−10LDU².
Thus that intrinsic opening is retained through every axial station. The
inserted real axle may occupy that opening in the assembled subsystem.

`prepareRetainedWinchNative` returns a sealed immutable
`ReviewedRetainedWinchPacket`: eight source carrier regions,135 input regions
and101 output regions,244 native children in total. Carrier and shaft geometry
retains every literal compiled source triangle; shaft surfaces are partitioned
at the actual paired bearing windows. The reference has8660 source triangles.
To consume this packet in ordinary Play, pass the actual canonical captures:
the preflight compares all12 occurrence IDs, namespaces, revisions, exact rest
frames and oriented F32 triangle multisets. Changed geometry or context refuses.
Stock-loader construction alone is labelled`source-constructor-only` and does
not establish actual renderer binding. Matched captures are labelled
`matched-canonical`; a structural packet clone never passes the seal.

`retainedWinchContactKind` classifies only sealed source regions as paired
tooth, local bearing or captured cap contacts. It never disables a native pair
itself. The native prototype applies the ideal1:8 equation only to the actual
tooth pair, keeps the inner keyed hub/core and every foreign contact active,
and scopes cap handling to the named supports on opposite literal source
halfspaces. Preflight checks every original source vertex against those
separating planes; this fixture has zero excess (`capPlaneRoundoffLdu`). Current and predicted native pivot/axis gates use0.05LDU and0.002
respectively; misalignment restores responding contacts. Geometry remains
present in every class. Both source revolutes explicitly enable native contacts.
Hooks use cached pre-step poses and do not query the mutably borrowed native
body set during`World.step`.

The native prototype uses declared ideal member mass0.05kg and bounding-box
inertia. These are simulation parameters, not measured LEGO material data.
Reactions and source-derived coordinates use actual native bodies and impulses;
no output pose or velocity is assigned. The fixed worm pair always remains
meshed. An upstream selector's neutral must isolate the real input branch;
there is no API which pretends the worm unmeshes in place. This ideal law does
not claim frictional self-locking or rope/drum load equivalence.

The focused checks demonstrate real retained input/output forward and reverse,
output stall and release, backdrive against independently computed reflected
inertia, a foreign thin blocker stopping the actual output shaft, and1LDU
misalignment restoring every source allowance. A mobile carrier receives
the actual input reaction and preserves native linear momentum within1e−6kg·m/s
and angular momentum within1e−5kg·m²/s. Source data and inventory stay unchanged. Reproduce the source/native evidence with:

```sh
FORCE_COLOR=0 npx vitest run tests/unit/retained-winch.test.ts tests/unit/winch-convex.test.ts tests/unit/retained-winch-native.test.ts --maxWorkers=1
```

Ordinary Play integration must still prove the external carrier's source
attachment, bind existing real group/joint bodies to this packet and expose the
reviewed worm equation without a blanket physical-eligibility fallback. Rope
winding/tension, the second winch, actual upstream selector isolation, Arocs
bevel/differential native packages and complete set operation remain separate
obligations. This bounded subsystem evidence does not close the full goal.
