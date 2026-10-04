# Cathedral door source-cover repair

The unchanged cathedral west-entry test stopped at Z=-779.155 before its nave.
The smooth 60616a door's single convex proxy joined its tiny axial pins to the
far body edge, creating a below-floor wedge absent from the rendered source.
The real body ends at local Y=136 (world Y=-16), while its pin reaches Y=136.75
within 2 LDU of the hinge. The interior floor starts 5 LDU beyond that hinge.

`src/play/door-leaf-solids.ts` clips the **actual captured occurrence triangles**
into five conservative convex covers: pins outside Y=[4,136], the body within
those planes and Z=[-3.75,3.75], and the two strictly protruding handle studs.
These body-end and handle-plinth planes come from the pinned 60616a/60616s01
source. Coplanar broad body faces stay in the body; they cannot expand a pin or
handle cover. Separating the studs also avoids a false frame obstruction during
closing. No authored model, pinned library file, transform, joint, mating region,
friction default or collision guard changes.

The covers remain separate for queries, with five native convex children counted
against existing aggregate budgets. Input, clipping, hull and native admission
checks run before proxy publication. Project-namespace copies keep the generic
path. Canonical member capture and the legacy world capture produce the same
prepared door points. These are bounded simulation covers, not exact CAD solids;
they still conservatively fill concavities within each cover.

The separate flat-rotation support check certifies the complete static triangle
candidates over each supported anchored Y-rotation interval. The guard remains
0.001 LDU. The door's floor tangent passes that geometric check; frame geometry,
foreign walls and a floor raised above the body retain ordinary contact checks.

Verification:

- All captured source vertices and triangle interiors retain a cover within the
  unchanged guard; direct native axial rays retain both hinge pins. The former
  below-floor far-edge wedge is absent.
- Actual 60596/60616a geometry opens 90 degrees and closes to its exact rest frame.
  A thin included wall blocks; a 0.1 LDU native wall blocks and removal permits
  retry. A floor raised 0.01 LDU blocks. Source buffers/project remain unchanged.
- The original cathedral entry and organ-gallery stair assertions pass, with
  added project and inventory preservation checks.
- Seven focused cases passed in 20.54 seconds on the shared VM. This is test
  execution evidence, not a hardware frame-rate claim.

Reproduce with Node 22:

```sh
npx vitest run tests/unit/play-door-leaf-solids.test.ts tests/unit/template-script-samples.test.ts -t 'keeps all actual|refuses excess|opens the actual|blocks a floor|retries after a thin|cathedral: in at the west door'
npx tsc -b
```

Source attribution: Max Martin Richter (MMR1988), **CC BY 4.0**, official LDraw
60616a and subpart 60616s01, pinned under `catalogue-2026-09-29`. Their files and
headers remain intact. SHA-256: 60616a
`4cff5172b1afdfd84bc56c2b0551132ef613fcad4c1fe9e4722afda6c7f917d4`;
60616s01
`386c401f8d77871530291ca333c51b7171ebefa3b2d7d27b1a6dc35462c78e87`.
