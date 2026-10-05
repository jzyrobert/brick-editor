# Connectors: snapping, connectivity and occupancy

The editor knows where the studs, side studs, jumper studs and anti-studs (the underside receptors that accept a stud) of catalogue parts, and of every other official LDraw part through a pack derived from the complete library (see [Complete official library](#complete-official-library)), are, where doors and window panes have hinge pins and door frames have hinge sockets, and what space each part's body occupies. It uses them to seat new parts on studs (upright or sideways), to hang doors in their frames, to refuse fits that would pass through another part, to report which parts are actually connected and to select a connected assembly. This page records where the data comes from, how each part is verified and what is not covered.

## Source and licence

The connector pack `ldraw-derived-connectors-2` (`src/catalog/connectors.json`) is **derived at build time from the pinned official LDraw geometry** (`public/libraries/catalogue-2026-09-29`) by `scripts/build-connectors.ts` (`npm run library:connectors`, run after `build-parts.ts` and `library:bounds`). The LDraw files are CC BY 4.0, so the derived positions, hinge data and occupancy boxes carry the same attribution; `public/notices/LDRAW.txt` states that they are derived from those files.

**No LDCad shadow-library data is used.** Spec §7.3 prefers the shadow library for wider connector families (clips, bars, Technic pins and axles, finger hinges). Its data carries CC BY-SA share-alike and attribution obligations that would extend to an adapted pack; adopting it needs a separately versioned, attributed pack, a record of the conversion's transformations and a documented licence review of the packaging obligations before any of its data enters this repository. Every family below is instead derived from the official geometry alone.

The pack records the library release and manifest hash it was derived from and is used only when that hash matches the current library lock. Its SHA-256 is locked in `src/catalog/data.json` (`connectorLock`), and **every project records it in its library lock** as `library.connectorPackId` / `library.connectorPackSha256` (spec §5; see [Project locks](#project-locks)). `npm run library:validate` and `tests/unit/connectors.test.ts` fail when the pack, its lock, the per-part `snapVerified` flags or any occupancy box drift from what the extractor derives from the library today.

## Derivation

The extractor flattens each part through its subfile tree with full transforms and BFC winding (CW files, `INVERTNEXT` and mirroring transforms taken into account), so every triangle knows which side its material is on. Triangles drawn by stud primitives are kept apart from the body.

- **Studs** (upright and sideways): every reference to an official stud primitive (`stud.dat`, `stud2.dat`, `stud2a.dat`, `stud10.dat`). Its axis is the transformed local −Y; its position is its top less 4 LDU along that axis, which is the primitive origin for an ordinary stud and the surface for a stud primitive stretched down into a slope (inverted slopes draw their studs that way). Each stud is then tested against the body geometry:
  - _seated_: at least half of 8 rays around it (radius 9 LDU), cast from just above its base back along its axis, meet the body within 1 LDU;
  - _exposed_: a 19 × 19 LDU cell, 8 LDU (one plate) high above its base, contains none of the body: room for the part that will sit on it.
- **Anti-studs**: LDraw has no receptor primitive; tubes, pins and walls only bound the space a stud goes into. Each stud-lattice cell (phase from the catalogue's `align`) of the **lowest plane of the body geometry** is tested against the flattened triangles. (The catalogue's box is conservative and can reach several LDU past curved geometry, so it is used only when a part has no body geometry.)

  1. a stud cylinder (radius 5.8, depth 3.8 LDU: a stud less a 0.2 LDU fit allowance) standing on the base plane must intersect no geometry,
  2. the part must close over it (upward rays across the stud's top face hit the part), and
  3. walls, tubes or pins must bound it in all four horizontal directions.

  Cells are classed as receptor, blocked (geometry in the way), open (nothing of the part above) or unenclosed (a roof but no walls, as under an arch's opening or a slope's overhang). Tube primitives are counted as corroborating evidence only.

- **Hinge pins** (doors, window panes): the part's highest and lowest points must both be narrow tips (within 3 LDU of their centre) on one upright axis; the leaf is everything more than 4.5 LDU from that axis and must reach at least 20 LDU from it. A pin leaves the leaf where the leaf's top (bottom) face is. Pins must protrude 0.25–6 LDU.
- **Hinge sockets** (door frames): upright round primitives of pin size (radius 1.8–3.6 LDU) only nominate an axis; the socket itself is tested geometrically. From the frame's mid-height, rays 3.2 LDU around the axis must all meet the sill below and the lintel above, each on one plane within 0.5 LDU, and rays on the axis and 1.9 LDU around it must pass those planes by at least 0.7 LDU (a hole a pin fits into). The two openings must be at least 16 LDU apart.
- **Occupancy**: the body triangles (stud primitives excluded, so a stud entering a receptor is never a clash; a door's pins beyond its leaf excluded, so a pin in its socket is not either) are clipped to cells one stud across (on the part's own lattice) and 4 LDU high. Each cell keeps the tight box of what lies in it; a face lying on a cell boundary counts only for the cell its material is on (from the BFC winding; both cells when a file is not certified), and an edge merely touching a cell does not count, so a ledge or a recess stays a step instead of filling its cell. Faces thinner than 0.6 LDU are widened to 0.6 within their cell, so a wall split across two cells still stops a part passing through it. Boxes are rounded outward to 0.05 LDU and merged where they tile exactly: a 2 × 4 brick is one box, a headlight brick two (the recess above its lip stays free), an arch 1 × 4 about a dozen that step with its curve. 1,681 boxes cover all 224 parts. Occupancy describes surfaces, not solids: a part wholly inside another's hollow is not detected.
- Stud-sized cylinders outside the stud primitives (hand-modelled studs the extractor would miss) are flagged and block verification, except at a recognised stud's own base (the inner wall of an open stud).

## Verification (`snapVerified`)

A part is verified only when one whole-part rule holds. The common checks: base plane on the 4 LDU grid, no duplicate studs, no flagged cylinders, studs on the part's own lattice (a jumper's half-offset stud excepted), every upright stud level a whole number of plates (8 LDU) above the base, and one stud level except for slopes and arches. Brackets and hinge bricks/plates are excluded because their principal connection is not yet a supported family.

| Rule                | Meaning                                                                                                                                                                                                                                                                              | Parts |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----: |
| `full-underside`    | Every footprint cell is a receptor, the lattice matches the catalogue footprint and the stud dimensions in the name, and every stud stands over a receptor (bricks, plates, tiles, slopes)                                                                                           |   120 |
| `matched-outline`   | Receptors sit exactly under the studs and no cell is obstructed (round and shaped parts)                                                                                                                                                                                             |     9 |
| `solid-base`        | No cavity at all and a full stud grid on top (baseplates)                                                                                                                                                                                                                            |     4 |
| `partial-underside` | Slopes and arches: footprint matches the name, no cell obstructed, at least one receptor, every stud (on any level) seated and exposed (arches, inverted and curved slopes)                                                                                                          |    21 |
| `side-studs`        | `full-underside` for the top studs, and every side stud points straight out of a face, is centred on a stud cell 10 LDU below the top studs, stands on the body at most 4 LDU inside the face (a headlight brick's recess), is seated and exposed, and their number matches the name |     6 |
| `jumper`            | A single seated, exposed stud centred on the footprint, half a stud off the lattice, over a full underside                                                                                                                                                                           |     2 |
| `hinge-leaf`        | A door or window pane (by category and name) with hinge pins found in its geometry; the pins are its verified connection (handle studs on it are left out)                                                                                                                           |     5 |

**167 of 224 catalogue parts are verified** (164 of the first 214; 128 before that). Of the ten parts added in release `catalogue-2026-09-29`, the door 60616b (hinge leaf), the door frame 30179 and the seat 4079 (full underside) verify; the roadster's wheel-pin plate, rim, tyre, mudguard, windscreen and steering stand and the flag do not (see below). The derivations are independent (primitive recognition for studs, geometric cavity tests underneath, geometric seat/room tests for every stud), so their agreement with the catalogue footprint and the numbers in each part's name is the evidence. Hand-checked expectations are pinned in `tests/unit/connectors.test.ts` for a 2 × 4 brick, plates, tiles, a 1 × 1 brick without tubes, a 45° slope, round bricks and plates, a baseplate, both jumper plates, all six side-stud bricks (including the headlight brick's recessed stud), an arch 1 × 4 and an arch 1 × 5 × 4 (studs on four levels), an inverted slope 2 × 2, the stretched studs of an inverted slope 3 × 1, a curved slope's real base plane, both doors' pins and both catalogue frames' sockets, and occupancy boxes for a brick, the headlight brick, an arch and a door. `connectors.coverage()` and `connectors.part({ ref })` report the result and the reasons for every unverified part.

Still unverified (57): the wheel-pin plate 4600 (a hand-modelled stud-sized cylinder, base off the 4 LDU grid), wheel rim 4624 and tyre 3641 (no stud connection; base off the grid), mudguard 3788 (studs on two levels outside the slope/arch family), windscreen 3823 and steering stand 3829c01 (no whole-part rule holds), the flag 2335 (clips); brackets, hinge bricks and hinge plates; plates with a clip or handles (the clip or bar is not a supported family, and a handle blocks some cells); the Technic plate and the spindled fence (hand-modelled stud-sized cylinders) and the plate with a hole (blocked cells); window glass and the container box door (no connection of their own); wedge plates and the cut-corner plate (thin corners leave cells unenclosed); the double/inverted slope 1 × 2 (footprint differs from its name), the inverted slopes 33° (their stretched studs rise out of a notch the seat test cannot confirm) and the inverted curved slopes; round corner bricks, plates and the quarter-round tile; the cone; flowers, plants, trees, dishes, the antenna and the container box. They stay fully usable with bounds-based stacking and grid placement and are reported as “no verified connector data”.

### Hinge data for opening doors

Doors and window panes carry their hinge in the pack so Play can swing them about the same axis the editor seats them on. `hingeData(ref)` (`src/catalog/connectors.ts`) and `connectors.part({ ref })` return, in the part's own LDraw space:

```ts
hinge: {
  axis: [0, -1, 0],           // unit hinge axis (LDraw −Y, up)
  pivot: [0, 70, 0],          // on the axis, halfway between the pins
  pins: [[0, 4, 0], [0, 136, 0]], // where the upper and lower pins leave the leaf
  protrusion: 0.75,           // longest pin beyond the leaf, LDU
  radius: 1.5,                // largest pin radius, LDU
}
sockets: [                    // frames: one entry per socket pair
  { top: [-32, 4, 5], bottom: [-32, 136, 5], depth: 8 }, // openings; depth capped at 8 (through hole)
]
```

A placed door's world pivot and axis are its occurrence transform applied to `pivot` and `axis`; turning about that line opens it. As connectors, pins and sockets are kinds `pin` and `socket` (pack codes `p` and `h`): a pin's axis points out of the leaf, a socket's opens towards the door, and a pin mates a socket exactly as a stud mates an anti-stud.

## Matching and fits

Two connectors mate when their positions coincide within 0.5 LDU and their axes are opposed (a stud pointing up into a receptor opening down; a pin into a socket). Only official catalogue occurrences with verified connectors and rigid, unmirrored placements (`physical` transforms) take part; placements may be in any orientation and off the world grid.

A **fit** is a transform of the new part at which at least one of its connectors mates and its occupancy passes through no other part. Fits are ranked nearest first; the Place tool shows the first and **Next fit** cycles through the rest.

- **Stud fits** (`snapCandidates`): the tap's earlier proposal (stack on a top face, beside a side face, under a bottom face, or on the workplane) moves to every position within one stud across and 4.5 LDU along the stacking direction where the part's anti-studs sit on visible verified studs or its studs in anti-studs, keeping the chosen turn. Ranked by distance from the proposal, then by contacts.
- **Side-stud fits** (`orientedCandidates`): a tap on a face whose verified studs (or anti-studs) point out of it and across the stacking direction turns the new part onto them: its up axis (local −Y) runs along the stud's axis, its x axis lies across the stacking direction, and **Rotate** spins it about the stud axis. Every upright connector of the new part is tried on every such connector within one stud of the tap; ranked by the target's distance from the tap, then by how near the part's body is to the tap, then by contacts. A 1 × 2 plate on a 1 × 4 brick with side studs lies across two studs; standing up on a headlight brick it may reach up past the top but not down through the lip under the recess.
- **Hinge fits** (`hingeCandidates`, `hingeSeats`): a door or window pane tapped onto a frame seats closed in each of the frame's socket pairs within 100 LDU of the tap: the upper pin at the upper socket on the socket axis, the leaf turned in quarter turns with the frame, kept where the lower pin reaches the lower socket within 1 LDU (the sizes match) and the leaf's centre lies within the frame's body box (closed, not swung out through a post). Each socket pair gives one hinge side; the pair nearest the tap comes first, and Next fit (or Rotate) swaps the side. The frame is exempt from the clash test (its sockets hold the pins); every other part is not. The catalogue doors (60616a, 60616b, 60623) seat in the catalogue frames (60596, 60599 and, since release `catalogue-2026-09-29`, 30179, whose four socket pairs the derivation finds), while a window pane (pins 60 LDU apart) fits none of them. The older doors 3644 (full-height hinge rod, no pins beyond the leaf) and 3861c/4486 (1 × 4 × 5) were checked and have no pins this derivation recognises; they are not claimed.
- **Clash test** (`clashes`): the new part's occupancy boxes against each occupant whose world box overlaps (broad phase). When the two parts' axes are aligned by any quarter turn the boxes are compared exactly in the occupant's space; otherwise each box is compared as its world box, which is conservative. Overlaps up to 0.5 LDU are ignored as numeric noise. A plate may now stand under an arch's opening, beside a slope's lower face or in a headlight brick's recess; the earlier single body box refused all three.
- **Hysteresis** (`chooseFit`): a new tap (or a re-snap after a turn) keeps the fit on show while it is still offered and no other fit is nearer by more than 6 LDU (`SNAP_HYSTERESIS`), so taps a few pixels apart, or a proposal swept across the midpoint between two studs, do not flicker between fits; the switch happens only once the other fit is clearly nearer.

## Complete official library

Every top-level part of the complete official pack (`ldraw-full-2026-09-28`, 24,735 parts) is derived and verified at build time by `scripts/build-full-connectors.ts` (`npm run library:full-connectors`), with exactly the extractor and rules above. It runs on worker threads (one per core; about ten minutes on four shared ARM cores). The spatial indexes added for it (stud checks test only the triangles within 16 LDU of the stud, the receptor enclosure rays walk only the grid cells they cross, and large point lists are reduced without argument spreading) leave the curated pack byte-identical and bring the slowest part, a 32 × 48 baseplate, from 45 s to 1 s.

- **What the rules read.** A part's LDraw title in the catalogue's style (`Brick  2 x  4` → `Brick 2 × 4`), its `!CATEGORY` mapped to the catalogue's categories (Brick → Bricks, Slope → Slopes, Arch → Arches, Door and Window → Windows & doors, Bracket and Hinge → Brackets & hinges, Baseplate → Baseplates; anything else keeps its LDraw category, to which no category-specific rule applies) and its footprint and grid phase from the pack's bounds, exactly as `extended.ts` derives the placement spec. Nothing is verified by name alone: the name only has to agree with what the geometry shows.
- **Pack.** `public/libraries/connectors-ldraw-full-2026-09-28/`: `manifest.json` (identity, the complete pack's release and manifest hash it was derived from, method, coverage by rule and LDraw category, and a table of 256 shards by sha256 and size) and `shards/<sha256>.bin`, the gzip of `{format, parts}` with the curated pack's per-part encoding. A part's shard is the FNV-1a hash of its name modulo the shard count, so no index is needed. 35.0 MB of JSON, 9.3 MB stored (about 37 kB per shard), 257 files. The lock (`src/catalog/full-connectors-lock.json`) is recorded in project locks as `library.full.connectorPackId/connectorPackSha256` and re-pinned like the curated connector pack (derived data; never geometry).
- **Loading.** The browser fetches the manifest and the shard of each top-level part together with the part's geometry (`loadFullSources`), verifies both against the lock and the manifest, caches them offline with the geometry, and registers them; views and health re-derive when they arrive. Missing connector data never fails a geometry load: such a part places by its bounds. The CLI reads shards from disk on first use. The offline snapshot precaches the shards the built-in templates need. `connectors.part/snap/fits/orient` load a complete-library part first, and `connectors.coverage().completeLibrary` reports the pack's coverage.
- **Use.** Snapping, side-stud and hinge fits, the clash test, connectivity, Select connected, stud workplanes, model health (overlaps compared by derived shape) and the template build checks use a complete-library part's data exactly as a catalogue part's. Catalogue parts always use the curated pack.
- **Validation.** `npm run library:validate` checks the lock, the binding to the complete pack, every shard's hash and format, one entry per top-level part in the right shard, the coverage counts, and re-derives sample parts (`scripts/validate-full-connectors.ts`).

**5,168 of 24,735 official parts are verified** (24,727 derived; 8 are not, because the official archive lacks a file they use): full underside 3,996, matched outline 914, partial underside 184, solid base 42, hinge leaf 22, side studs 10. By LDraw category (parts, verified):

| Category                      |  Parts |    Verified |
| ----------------------------- | -----: | ----------: |
| Minifig                       |  3,076 |         250 |
| Sticker                       |  2,856 |           0 |
| Sticker Shortcut              |  1,769 |       1,102 |
| Tile                          |  1,678 | 1,269 (76%) |
| Technic                       |  1,367 |          54 |
| Brick                         |  1,324 |   824 (62%) |
| Electric                      |  1,280 |          94 |
| Moved                         |  1,160 |         177 |
| Figure                        |    948 |           4 |
| Obsolete                      |    901 |         145 |
| Minifig Accessory             |    824 |          24 |
| Slope                         |    527 |   429 (81%) |
| Animal                        |    506 |           4 |
| Plate                         |    483 |   198 (41%) |
| Train                         |    434 |          42 |
| Wheel                         |    343 |           0 |
| Panel                         |    232 |         138 |
| Door                          |    228 |         104 |
| Baseplate                     |    194 |          26 |
| Window                        |    179 |          47 |
| Arch                          |     60 |    48 (80%) |
| Hinge, Bar, Tyre, Dish, Duplo |    661 |           0 |
| All                           | 24,735 | 5,168 (21%) |

Stickers have no studs; stickered-part shortcuts verify through their part. `Moved` entries are `~Moved to` stubs that draw their target. The rules are conservative for parts the catalogue curates with an explicit footprint or grid phase: 12 of the 167 verified catalogue parts do not verify from their LDraw titles and bounds alone (jumper plates and plants whose stud is off the bounds-derived lattice, side-stud bricks whose LDraw titles say "Stud on 1 Side", a curved-top brick, a round tile), and none verifies there that the catalogue leaves unverified. Hand-checked derivations are pinned in `tests/unit/full-connectors.test.ts` (3065, 3068a, the door 60614 and window pane 3854, and reasons for 4600, 3644 and 2335).

Verified means the listed stud, anti-stud or hinge connectors are proven; other features of the part (clips, bars, Technic holes and pins, wheel pins) are not modelled. Health therefore still reports parts that nest through such a connection (the castle's flags on their pole, the roadster's wheels on their pins, tyres on rims and under the mudguard) as overlaps, now compared by derived shape and labelled as involving parts whose connection is not modelled.

## Where it is used

- **Placing (Place tool).** A tap computes the fits above and shows the first; the status line reports the connections (“Preview stacked on top. Snapped to 8 stud connections. Fit 1 of 3.”, “Turned onto the side studs: 1 stud connection.”, “Seated in the frame: 2 hinge pins.”). When more than one fit is offered, the placement card gains a compact **Next fit** button showing the position in the list (→ 1/3); on a desktop **N** or **Tab** (with focus on the page or canvas) does the same. The preview shows each fit, including a side-stud or hinge fit's orientation, and Place part commits exactly what is shown. Typing coordinates keeps the orientation but drops the fit list. Without verified data on both sides, the bounds-based proposal stands.
- **Model health.** The Connections check groups verified parts by stud and hinge connections and lists every part outside the largest group. It is `exact` when every part is verified, `approximate` when some are not and `not-verified` when none are. The touching-box “Separate groups” and box-based “Overlapping parts” checks are unchanged.
- **Connected selection.** Inspector → Extras → Selection tools → **Select connected** follows verified stud and hinge connections. Automation: `connectors.connected({ occurrenceIds })`, `connectors.groups()`; CLI: `brick-cli connectors --input file [--connected '["[\"n1\"]"]']`.
- **Connector workplane.** Inspector → Extras → Workplane and grid → **Pick a stud** puts the workplane on the base of the nearest verified stud of the tapped part (upright or sideways), with its axes following that part and its origin on a stud-cell corner.
- **Automation.** `connectors.validatePlacement(...)` and `connectors.validateMove(...)` (Snap together, below), `connectors.coverage()`, `connectors.part({ ref })` (with `hinge`/`sockets`), `connectors.snap({ part, position, angle? | basis?, up?, previous? })` (with `fit` and `fits` counts), `connectors.fits(...)` (the ranked list Next fit cycles), `connectors.orient({ part, point, normal, angle?, up? })` (hinge or side-stud fits for a tap on a face).

## Connected building (Snap together)

A tool setting for building like with real bricks: with **Snap together** on, the Place tool only places a part that holds somewhere, and moves with the Move and rotate handles (or exact move and rotation) may not pull connected parts loose. It is on by default for everyone (kids first), remembered per device (`localStorage` key `brick-editor-snap-together`), and switched on the placement card (the **Snap together** switch next to the part name) or in Inspector → Move and rotate. It is not document data: opening, importing or editing a model (the Santorini build, templates) is never affected, only new placements and handle moves.

**When a part holds** (`src/edit/connected-placement.ts`, `checkConnection`), in this order:

1. **No clash.** Its occupancy passes through no other visible part (the clash test above; a hinged leaf's own frame is exempt). A clash is refused: “Another part is in the way here — try a different spot.”
2. **Verified connection.** One of its verified connectors mates with a visible part's verified connector (0.5 LDU, opposed axes): studs in anti-studs from above or below, side studs, jumper studs, or hinge pins in a frame's sockets. Reported as “Connects with N studs.” or “Clicks into the hinges.”
3. **Ground.** Its lowest point (the box of its geometry, max LDraw y) is on the ground, y = 0 within 0.5 LDU: the table the build stands on. A baseplate on the ground holds this way; parts on the baseplate hold through its studs (2). A part sunk below the ground or lifted above it does not.
4. **Unverified rest.** Only where connector data is missing on either side (the new part is unverified, such as a brick hinge, bracket, clip plate or wedge plate, or it is placed on an unverified or custom part): its underside rests on the top of that part's box (between the body top and the stud tops, within 0.5 LDU) with at least 0.5 LDU of footprint overlap. This is reported as an unchecked connection (“Rests on a part (this connection isn't checked).”, `verified: false`), never as a verified one. Unverified parts cannot hang underneath, sit beside or float; two verified parts that merely touch (a brick half a stud off the lattice, a tile on a tile) do not hold either, because their data says no stud mates. A part whose shape is not known at all (no bounds) is allowed and reported as `unchecked`.

Anything else floats: “Nothing to connect to here — move it onto studs or the ground.”

**In the Place tool** the ranked fits above still come first, and all of them connect; with no fit near the tap, the proposal (stacked, beside, on the workplane) is checked. A refused preview stays on show so the reason is visible: the ghost is tinted red, the card shows the reason in place of the tap hint (on phones it wraps to a second line rather than being cut off), the status toast repeats it, and **Place part** is disabled. Typing coordinates, rotating and Next fit are checked the same way. With the switch off, placement is free as before.

**Moves** (`checkMove`; the Move and rotate handles, exact move and rotation, and the Inspector's Rotate 90° and 1 plate up/down): the moved parts are checked as a group against every visible part outside it. The group holds when none of them clashes with an outside part and at least one holds on an outside part or the ground by the rules above; parts inside the group may hold only on each other. A move is refused only when the group held where it was and would not where it goes, so parts that already floated (an imported model off the ground, a part placed with the switch off) move freely. A refused move changes nothing (a handle drag springs back) and the status says “Not moved: it would float…” (or “another part is in the way there”). Parts left behind are not checked: moving the bottom brick of a tower away leaves the rest standing in the air, as undo would.

**Not enforced** (unchanged behaviour whatever the switch): paste, duplicate, arrays, fill, typed positions in the Inspector, undo/redo, imports and templates, and every automation command. Automation can ask with `connectors.validatePlacement` and `connectors.validateMove` ([API](API.md#connectors)).

## Project locks

New projects record `library.connectorPackId` and `library.connectorPackSha256` next to the geometry lock. Loading a project (IndexedDB, localStorage recovery, checkpoints, native files) on the current library adds the current connector pack when the project has none (saved before this pass) or records a different one; the previous value (null when none was recorded) is appended to `metadata.previousLocks` as `{ connector: … }`, like a re-pinned library or mapping lock. The connector pack is derived data that changes no geometry, only snapping and connectivity reports, so it is re-pinned rather than refused; a project on another library keeps its lock untouched. Clipboard fragments compare only the geometry lock, so a fragment copied before the pack was recorded still pastes. The complete library's derived pack is recorded the same way in `library.full.connectorPackId/connectorPackSha256` and re-pinned (previous value in `previousLocks` as `{ fullConnector: … }`) while the project's complete pack is the current one.

## Not covered

- **Clips and bars** (the clip plate 4081b, handles on plates 3839b/48336/60478, the antenna): a clip grips a bar with rotational and sliding freedom. Bars could be found geometrically (exposed cylinders of radius 4 LDU) and clips as matching C-shaped hollows, but a clip–bar fit needs an angle and slide the Place tool has no control for yet.
- **Brick hinges and hinge plates** (3937/3938, 4275b/4276b, 2429/2430): finger hinges connect by interleaved fingers on a pin with an angle of freedom; like clips they need an articulation control. Their studs and receptors could be verified once the rule set accepts parts whose principal connection is unverified.
- **Technic pins and axles**: the catalogue has Technic holes (3709b) but no pins or axles to put in them. Holes could be derived like hinge sockets (horizontal radius-6 LDU holes through a beam).
- **Side anti-studs** (the back of a bracket's vertical plate) and therefore brackets: the receptor test would have to run on each side plane; brackets stay unverified.
- A part wholly inside another's hollow (occupancy is surfaces, not solids); clashes between two tilted parts are box-conservative.
- Clutch strength, structural support and assembly order.
- Door/frame pairs in the catalogue: 60616a, 60616b and 60623 seat in 60596, 60599 and 30179 (release `catalogue-2026-09-29` added 60616b and 30179). Older doors (3644, 3861c/4486) have no pins this derivation recognises; 3861c's stud and anti-stud on its hinge axis verify as `matched-outline` in the complete-library pack, but it is not placed in a frame's sockets.
