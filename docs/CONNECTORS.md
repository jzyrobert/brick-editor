# Connectors: stud snapping and connectivity

The editor knows where the studs and anti-studs (the underside receptors that accept a stud) of catalogue parts are, and uses them to seat new parts on studs, to report which parts are actually connected and to select a connected assembly. This page records where the data comes from, how each part is verified and what is not covered.

## Source and licence

The connector pack `ldraw-derived-studs-1` (`src/catalog/connectors.json`) is **derived at build time from the pinned official LDraw geometry** (`public/libraries/catalogue-2026-09-28`) by `scripts/build-connectors.ts` (`npm run library:connectors`, run after `build-parts.ts` and `library:bounds`). The LDraw files are CC BY 4.0, so the derived positions carry the same attribution; `public/notices/LDRAW.txt` states that they are derived from those files.

No LDCad shadow-library data is used (spec §7.3 prefers it for wider connector families). That avoids the CC BY-SA share-alike obligations for now; adopting the shadow library for clips, hinges, pins and side studs later would still need its own versioned, attributed pack and a licence review.

The pack records the library release and manifest hash it was derived from. It is used only when that hash matches the current library lock, and its own SHA-256 is locked in `src/catalog/data.json` (`connectorLock`). `npm run library:validate` and `tests/unit/connectors.test.ts` fail when the pack, its lock or the per-part `snapVerified` flags drift from what the extractor derives from the library today.

## Derivation

- **Studs**: every reference to an official stud primitive (`stud.dat`, `stud2.dat`, `stud2a.dat`, `stud10.dat`) is followed through the subfile tree with its full transform. The stud's position is the primitive's origin (the stud base) and its axis is the transformed local −Y. Studs that point sideways (headlight bricks, brackets) are recorded but not validated.
- **Anti-studs**: LDraw has no receptor primitive; tubes, pins and walls only bound the space a stud goes into. Each stud-lattice cell of the part's lowest plane (lattice phase from the catalogue's `align`) is tested against the part's flattened triangles:

  1. a stud cylinder (radius 5.8, depth 3.8 LDU: a stud less a 0.2 LDU fit allowance) standing on the base plane must intersect no geometry (exact triangle–cylinder test after clipping to the cylinder's height),
  2. the part must close over it (upward rays across the stud's top face hit the part), and
  3. walls, tubes or pins must bound it in all four horizontal directions.

  Cells are classed as receptor, blocked (geometry in the way), open (nothing of the part above, as outside a round part) or unenclosed. Tube primitives (`stud3`, `stud4`…) are counted as corroborating evidence only.

- Stud-sized cylinders outside the stud primitives (hand-modelled studs the extractor would miss) are flagged and block verification.

## Verification (`snapVerified`)

A part is verified only when one whole-part rule holds, on top of common checks: every stud points up, all studs share one level, the stud level is a whole number of plates (8 LDU) above the base, the base plane is on the 4 LDU grid, every stud lies on the part's own stud lattice, there are no duplicate studs and no flagged cylinders. Bracket and hinge parts are excluded because their principal connection is not a stud connection.

| Rule              | Meaning                                                                                                                                                                                    | Parts |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----: |
| `full-underside`  | Every footprint cell is a receptor, the lattice matches the catalogue footprint and the stud dimensions in the name, and every stud stands over a receptor (bricks, plates, tiles, slopes) |   115 |
| `matched-outline` | Receptors sit exactly under the studs and no cell is obstructed (round and shaped parts)                                                                                                   |     9 |
| `solid-base`      | No cavity at all and a full stud grid on top (baseplates)                                                                                                                                  |     4 |

**128 of 214 catalogue parts are verified.** The two derivations are independent (primitive recognition on top, geometric cavity tests underneath), so their agreement, together with the catalogue footprint and the stud dimensions in each name, is the evidence. `tests/unit/connectors.test.ts` additionally pins hand-checked expectations for a 2 × 4 brick, a 1 × 1 plate, tiles, a 1 × 1 brick without tubes, a 45° slope, round bricks and plates (including the empty corners of a 4 × 4 round plate) and a baseplate, and checks that side-stud, jumper, bracket and hinge parts stay unverified. `connectors.coverage()` and `connectors.part({ ref })` report the result and the reasons for every unverified part.

Unverified parts include jumper plates (their centred stud is off the stud lattice), parts with side studs, brackets and hinges, arches and inverted slopes (studs on several levels or partial undersides), curved slopes with off-grid bases, windows' glass, doors, flowers, trees and the container box. They stay fully usable with the earlier bounds-based stacking and grid placement, and are reported as “no verified connector data”.

## Matching

Two connectors mate when their positions coincide within 0.5 LDU and their axes are opposed (a stud pointing up into a receptor opening down). Only official catalogue occurrences with verified connectors and rigid, unmirrored placements (`physical` transforms) take part; placements may be in any orientation and off the world grid.

## Where it is used

- **Snapping (Place tool).** A tap still computes the earlier proposal (stack on a top face, beside a side face, under a bottom face, or on the workplane). If the chosen part is verified, the proposal moves to the nearest position within one stud across and 4.5 LDU along the stacking direction at which its anti-studs sit on visible verified studs, or its studs in anti-studs; nearest wins and more contacts break ties. A candidate whose body box (studs excluded) would pass through another part is refused. The part's orientation is kept; a 90° turn re-snaps the preview at the same level. The status line says how many stud connections were made (“Preview stacked on top. Snapped to 8 stud connections.”). Without verified data on both sides, the bounds-based proposal stands. `connectors.snap()` exposes the same calculation to automation.
- **Model health.** The Connections check groups verified parts by stud connections and lists every part outside the largest group. It is `exact` when every part is verified, `approximate` when some are not (they could bridge groups; the detail says how many) and `not-verified` when none are. The touching-box “Separate groups” check is unchanged.
- **Connected selection.** Inspector → Selection tools → **Select connected** replaces the selection with everything joined to it by verified stud connections (hidden, locked or out-of-scope parts are left out and counted). Automation: `connectors.connected({ occurrenceIds })`, `connectors.groups()`; CLI: `brick-cli connectors --input file [--connected '["[\"n1\"]"]']`. `query({ connectivity: "verified" | "unverified" })` filters by coverage and every query reports `connectivity.coveredIds` and `missingConnectorCoverageIds`.
- **Connector workplane.** Inspector → Workplane and grid → **Pick a stud** puts the workplane on the base of the nearest verified stud of the tapped part, with its axes following that part and its origin on a stud-cell corner, so the ordinary 20 LDU grid keeps new parts on that part's studs even when it is turned or off the world grid.

## Not covered

- Connector families other than upright studs and downward anti-studs: side studs and side anti-studs, clips and bars, hinges, Technic pins and axles, jumper (half-offset) studs.
- Snap-candidate cycling and hysteresis (spec §11.2); the nearest candidate is taken.
- Occupancy beyond body boxes: the clash test is box-based and conservative for turned parts.
- Clutch strength, structural support and assembly order.
- Project library locks do not yet record `connectorPackSha256` (spec §5); the pack is bound to the library release instead.
