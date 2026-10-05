# Retained crane winch: source witness and native baseline

This is a source-interface checkpoint, not production admission or a working
winch certificate. It complements [the drivetrain source review](TECHNIC-DRIVETRAIN-INTERFACES.md)
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

The next required slice is a bounded source-preserving collision/contact
partition: actual paired bearing and tooth regions may support a reviewed
ideal law while core and foreign contacts remain active. It must preserve
every source region and opening and demonstrate actual load, stall,
backdrive and neutral isolation before a session entry hook is admitted.
Rope winding/tension, the second winch, full carrier attachment, selector
state and complete crane operation remain separate obligations.
