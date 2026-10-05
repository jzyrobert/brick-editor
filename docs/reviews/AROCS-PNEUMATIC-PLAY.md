# Air circuits in ordinary Play: the 42043 pump, valve and cylinder

Ordinary Play now runs a complete, routed air circuit built from the reviewed
2015 Arocs (42043) pneumatic hardware: hand-pump air into the tubes, set the
valve, and the cylinder rod slides out or in under simulated air pressure,
pushing loose parts in its way. The **Air pump & cylinder** sample shows it on
an original bench. This is the first of the three Technic systems in
[TODO.md](../../TODO.md) to reach ordinary Play; the complete Arocs is still not
admitted (see [What stays still](#what-stays-still)).

It builds directly on the reviewed foundations: the
[source routing](AROCS-PNEUMATIC-ROUTING.md), the
[pump bench](AROCS-PNEUMATIC-PUMP-NATIVE.md), the
[cylinder bench](AROCS-PNEUMATIC-CYLINDER-NATIVE.md) and the native
`NativePneumaticCircuit` kernel. Their seals, guides, stops and contact rules
are used unchanged.

## Why pneumatics first

The three open items were weighed on what each still lacked for ordinary Play:

- **5540 vehicle:** 446 occurrences and 237,866 attached triangles; dynamic
  triangle meshes give false deep contacts. A bounded convex representation of
  the whole vehicle is a large open problem.
- **42042 winch:** the native five-body packet works in isolation, but nothing
  in the reviewed excerpt drives it (the set's motor and gearbox are elsewhere),
  and there is no rope or load model. A "wind in" button would invent an input.
- **42043 pneumatics:** the pump bench already takes bounded hand force on its
  real rod, the cylinder bench takes pressure from the real routed valve, and
  the routing review binds hoses to ports for any project with the reviewed
  definitions. Only the moving rods need native bodies; everything else can stay
  in the static world. This was the one item that could become genuinely usable
  without inventing an input or a connection.

## What is admitted

`derivePneumaticPlay` (`src/play/pneumatic-play-source.ts`) finds the reviewed
hardware with the semantic source index: each embedded `42043 - 2943-v2.dat`
pump base with its official 99799 barrel, 2941 cap and 2944 rod in their
reviewed positions, and each embedded `42043 - 19466c01.dat` cylinder body with
its `42043 - 19467c01.dat` rod inside the reviewed guide (200–330 LDU eye
separation). The session-only rig `pneumatic:0` names these groups for the
Controls sheet and camera framing; it has no joints and is never saved.

`preparePneumaticPlay` then refuses the whole circuit, with the reason shown to
the player, unless all of these hold on a private, deeply frozen copy of the
build:

1. Every reviewed definition closure (pump base, valve, cylinder, rod, tube end
   and segment, and the pump's two factory shortcuts) hashes to its manifest.
2. The complete routing seats every port: each 165 tube end on exactly one
   reviewed barb, no open port, no shared port (`sourcePneumaticTopology`).
3. The routing's pumps and cylinders are exactly the derived ones.
4. Each cylinder has exactly one valve whose two work lines reach its two
   chambers, and that valve's supply is reached from a pump outlet.
5. The compiled pump and cylinder surfaces match their reviewed digests
   (`prepareSourcePneumaticPump`, `prepareSourcePneumaticCylinder`).

Surfaces are compiled in the browser by the renderer's own LDraw parser from the
project's embedded definitions and hash-verified library texts
(`compileReviewedPneumaticSurface`), the same way the bench tests do; they are
then accepted only through the reviewed digest check. They are not compared
triangle by triangle with the renderer's leaf captures.

## What moves, and what stays

Only the **pump rod** and each **cylinder rod** become dynamic native bodies,
each on its reviewed prismatic guide with its reviewed stops and its exact
shaft/case seal allowance. The pump case and cylinder body become fixed native
bodies (their source triangles, pin holes included). Valves, tubes, levers and
every other part stay in the static world, exactly where the build puts them.
Static parts in Play never claim support, so this asserts no pivot, tube flex
or chassis attachment: the pump case does not swing on its axle, tubes do not
bend, and the valve lever is not animated (the controls choose the valve state;
which lever direction routes which port is not taken from a source, so the lever
is not drawn moving).

Rods keep every other contact: the explorer, loose dynamic parts and the static
world all respond. The walking world gets the pump case and cylinder body as
fixed colliders and rod copies that follow the native bodies; walking into a rod
gives the same bounded push as any dynamic body. Rods are rendered through the
session's transient pose, as other mechanisms are.

If a rod is knocked more than the kernel's 1 mm alignment band off its guide,
the kernel refuses the tick atomically. The circuit then holds its air, the
hand lets go and the controls say "A rod was knocked out of line" until the
native joint brings it back; Play continues.

## Declared simulation settings

`PNEUMATIC_PLAY_SETTINGS` (`src/play/pneumatic-play.ts`) are gameplay values at
the 0.02 m/LDU scale, not measured LEGO ratings:

| Setting                      | Value           | Why                                                                                                                               |
| ---------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Pump rod / cylinder rod mass | 5 / 20 kg       | The ideal isothermal gas spring of a trapped chamber is stiff; these masses keep it stable at the fixed 60 Hz step (ω·dt below 1) |
| Hand force limit             | 150 N           | The most a hand pushes or pulls on the pump rod; caps pump pressure near 1.9 kPa                                                  |
| Hand pace, gain, grip        | 2 m/s, 150, 600 | A hand aims for a steady stroke, eases off near each end, and presses harder (to its limit) while air resists                     |
| Seal friction / rod damping  | 5 N, 1/s        | The hidden seal of the omitted piston: Coulomb friction on the guide plus light damping                                           |
| Line volume per port         | 0.01 m³         | Tube and fitting dead volume                                                                                                      |
| Pump dead volume             | 0.004 m³        | Air left in the pump chamber at the end of its stroke                                                                             |
| Cylinder force limit         | 1,000 N         | Above any pressure a hand can build, so cylinder force is never silently clipped                                                  |

The pump's own reaction envelope (1,000 N, refuse rather than clip) and every
bench guide, stop and seal are unchanged. The hand reverses at each end of its
stroke and whenever it presses as hard as it can without progress: pushing, that
is a stall (the air is at the hand's limit, reported as "Full"); pulling, the
rod's gasket has reached the cap.

## Controls

The Play HUD's **Controls** opens the same sheet as motors. For an air circuit
it shows, in plain words:

- **Air pressure** (None / Low / Medium / Full, as a share of what a hand can
  reach) with a meter.
- **Pump**, a latched control like a motor's Forward: tap to keep pumping, tap
  **Stop pumping** to let go. Pause, switching mechanism and closing the sheet
  also let go. A status line counts strokes or explains a stall.
- One row per cylinder: the rod's travel (**Rod out 47%**) with a meter, and the
  valve as **Pull in / Hold / Push out**, named by what the rod does. The labels
  come from the actual routing: in the sample, work port B feeds the base
  chamber, so "Push out" is the kernel's `retract` state.
- **How the air works** folds away a short explanation.

Automation uses `play.setPneumatic({rigId?, pumping?, pumpId?, valves?})` with
valve positions `out`, `hold` or `in`; reports carry `mechanisms["pneumatic:0"].pneumatic`.
`play.enter({pneumatics:false})` and the card's **Static build** keep the
circuit still. Refusals appear in `snapshot.pneumatics.skipped`.

## The sample

`scripts/pneumatic-sample-node.ts` generates
`fixtures/ldraw/templates/air-pump.mpd`: an original CC0 bench (two 8 × 16
plates, a 2 × 4 plate under the pump, smooth tiles for the crate) with a pump,
one valve, one cylinder and three generated LDCad tubes whose ends sit 4 LDU
beyond each barb tip (16 LDU inserted, on axis). The pump base, valve and
cylinder definitions are copied byte for byte from the reviewed excerpts and keep
their CCAL 2.0 headers and the original OMR hash. A loose three-part crate is
the only authored rig (Dynamic, 5 kg declared). The app fetches the text on
demand and the offline snapshot precaches it with the library chunks the Play
check reads.

## Verification

```sh
npx vitest run tests/unit/play-pneumatic-air-pump.test.ts tests/unit/play-pneumatic-presentation.test.ts --maxWorkers=1
npx playwright test -c <private config> --project=main tests/browser/play-air-pump.spec.ts
```

Node session checks (shared VM): with the valve closed the hand fills the short
supply tube and stalls; with **Push out** the rod travels over 80% of its
stroke in 1,500 ticks and its rendered leaves move 100–130 LDU; **Hold** keeps
it within 5%; **Pull in** returns it below 10%. A static obstacle stops the rod
at 23% while the pump reports full pressure. Removed tubes, a 2947 cylinder, a
missing pump, a missing pump rod and a rod outside its guide are each refused
with their reason. Project and LDraw export are unchanged.

In the production bundle (desktop and 390 × 844 phone emulation), the sheet's
**Pump** and **Push out** pushed the crate more than 20 LDU along the tiles and
extended the rod past 60% within 1,800 ticks; **Pull in** brought it back below
15%; closing the sheet let go of the pump and kept the valve. A private 1,500-tick
run measured 1.2–2.1 ms per tick including snapshots, and Play entry about 1 s,
in SwiftShader Chromium on the shared ARM VM. These are not phone-hardware
measurements.

## What stays still

- The **complete Arocs**: its four cylinders move a crane arm and bucket that
  need mounted, pivoting cylinders with moving tubes; its pump is driven by the
  PF-L motor through a crank; its four valves are worked by lever linkages.
  None of these connections is admitted.
- **Other cylinders**, including the 2947 1 × 5 and the small u9145 Arocs
  cylinder: no reviewed moving rod yet. A circuit containing one stays still.
- **Pivoting pumps or cylinders, flexing tubes, lever animation** and cars
  driving into air-circuit parts (the driving world does not include the native
  pump case or cylinder body).
- Measured LEGO pressures, forces, leakage, and phone frame-rate evidence.

Screenshots: [phone 390 × 844](../screenshots/air-pump/phone-390x844.png), [landscape 686 × 411](../screenshots/air-pump/landscape-686x411.png), [desktop](../screenshots/air-pump/desktop.png).
