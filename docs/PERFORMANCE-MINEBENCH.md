# Large builds on phones: what Minebench does, and what it means here

[Minebench](https://github.com/Ammaar-Alam/minebench) (spec reference S45, MIT code) shows two AI-generated voxel builds of 150,000–200,000 blocks side by side on a phone without lagging. This note records how it does that (studied at commit `master`, September 2026), which of its techniques carry over to LDraw parts, what was built here, and the measurements.

## 1. How Minebench draws 200,000 blocks

| Stage                | What Minebench does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Where                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Storage and transfer | The source JSON is kept only as the benchmark record. The viewer gets **MBV4**: a 16-byte header, a palette of block names, then `Uint16` x/y/z and a `Uint16` palette index per block — **8 bytes per block** (≈1.6 MB for 200,000 blocks), gzip on the wire (`DecompressionStream`), decoded straight into typed arrays. Builds of ≥ 150,000 blocks ship **MBF1** "mesh facts" instead: MBV4 plus one byte of visible-face mask per block and one byte of packed ambient occlusion per visible face, precomputed on the server. A ~3,000-block preview is shown first. | `lib/voxel/binaryBuild.ts`, `lib/voxel/meshFacts.ts`, `lib/arena/buildDeliveryPolicy.ts`, `buildArtifacts.ts` |
| Hidden-face culling  | A face is emitted only when its neighbour is empty or not an occluder; blocks with no visible face are dropped before meshing.                                                                                                                                                                                                                                                                                                                                                                                                                                           | `lib/voxel/ambientOcclusion.ts` `computeVisibleFaceMask`, `renderVisibility.ts`                               |
| Meshing              | **No greedy meshing** for normal builds: one quad (4 vertices, 6 indices) per visible face, AO baked into `Uint8` vertex colours. Narrow attributes: `Float32` positions, `Int8` normals, `Uint16` UVs, `Uint8` colours, `Uint32` indices (≈112 bytes per visible face). Greedy meshing and GPU-decoded quads exist only in a separate "large world" path (grids above 512).                                                                                                                                                                                             | `lib/voxel/mesh.worker.ts`, `meshBuckets.ts`, `worldRegionMesh.ts`                                            |
| Workers              | Builds above 8,000 blocks are meshed in a module worker; typed arrays are transferred both ways; mesh payloads are cached in IndexedDB (6 entries, 160 MB).                                                                                                                                                                                                                                                                                                                                                                                                              | `lib/voxel/mesh.ts`                                                                                           |
| Drawing              | **At most five meshes per build** (opaque, cutout, transparent, water, emissive), one texture atlas, vertex colours, Lambert materials, no shadows, no instancing, no LOD, no chunking (Three.js culls the whole build by its bounding sphere).                                                                                                                                                                                                                                                                                                                          | `lib/voxel/mesh.ts` `createVoxelGroupFromMeshPayload`                                                         |
| Frame policy         | Renders **on demand** (controls change, damping, resize). On phones: **pixel ratio capped at 1.5** ("cuts fragment work ~30% vs 2×"), **no MSAA**, `forceContextLoss` on unmount.                                                                                                                                                                                                                                                                                                                                                                                        | `components/voxel/VoxelViewer.tsx`                                                                            |

No triangle counts or phone frame rates are published. A 200,000-block build with walls one block thick shows about two faces per block, i.e. roughly 0.5–1 million triangles in five draws; a solid 60 × 60 × 55 block shows only its 21,600 surface faces (43,000 triangles). That — not a clever draw path — is why it is smooth: **almost nothing that cannot be seen is sent to the GPU**, and what is sent is drawn at a modest pixel density.

## 2. Why LDraw parts are different

A voxel is 12 triangles and nothing inside it. An LDraw part is a detailed model:

| Part                         | Triangles | Edge lines | Conditional lines | Studs | Closed shell (see below) |
| ---------------------------- | --------: | ---------: | ----------------: | ----: | ------------------------ |
| 3001 Brick 2 × 4             |       700 |        472 |               224 |     8 | yes                      |
| 3004 Brick 1 × 2             |       172 |        120 |                48 |     2 | yes                      |
| 3005 Brick 1 × 1             |        76 |         56 |                16 |     1 | yes                      |
| 3020 Plate 2 × 4             |       700 |        472 |               224 |     8 | yes                      |
| 3068b Tile 2 × 2 with groove |       178 |        100 |                32 |     0 | yes                      |
| 3062b Round brick 1 × 1      |       384 |        160 |                96 |     1 | no                       |
| 3039 Slope 45 2 × 2          |       352 |        164 |               107 |     2 | no                       |
| 3811 Baseplate 32 × 32       |    49,236 |     32,808 |            16,404 | 1,024 | no                       |

In a 2 × 4 brick, **384 of the 700 triangles are its studs and 298 its underside cavity** (tubes, inner walls, the underside of the top). Only 18 triangles are the outer box. In a wall, floor or solid block, almost every stud sits inside the part above it and almost every underside rests on the part below — the LDraw equivalent of Minebench's hidden faces, but 40 times larger per part.

## 3. What was built: hidden-geometry culling

Three modules and two small hooks (`src/render/hidden-geometry.ts`, `occlusion.ts`, `hidden-view.ts`; `RenderBatches.setVariantProvider` and a line in the adapter's budget check).

**Per part, once** (`hidden-geometry.ts`, cached per compiled geometry, shared by colour variants):

- Each triangle and line segment is classified: inside the cylinder of stud _i_ (radius 6, height 4 LDU above the verified stud connector, with margins for logos), or **inside the closed shell**. A part has a closed shell when its four sides and top are completely covered (sampled every LDU) by faces within 1.5 LDU of its bounding box — plain bricks, plates and tiles, including a tile's 1 LDU bottom groove; round, sloped, window and printed-top parts fail the test. Cavity primitives are those strictly inside that shell: they can only be seen through the open bottom.
- A **variant** leaves out a set of hidden primitives by building a new index over the original vertex attributes: the GPU buffers are shared, only the index is new (for lines too).

**Per model** (`occlusion.ts`, from placements and connector data, never from the camera):

- A **stud is hidden** when an anti-stud of another opaque part receives it (same lattice point, opposed axis). Transparent parts neither hide nor are culled.
- Closed-shell parts on the model's lattice fill a grid of 20 × 8 × 20 LDU cells. A part's **cavity is hidden** when every cell below it is filled by opaque closed-shell parts, its studs when every cell above is, and the **whole part** when every cell around all six faces is (Minebench's blocks with no visible face).
- Lookups are sorted `Float64Array`s of packed lattice keys, not maps of strings.

**Per frame** (`batching.ts`): the batches decide per refill which geometry each drawable draws:

| View                                                                | What is left out                                                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Plain view: every part drawn, untreated, in place, no section plane | Hidden studs and cavities, enclosed parts, and cavities whose downward opening faces away from the eye |
| Steps, floor focus, hidden layers, ghosting, explode                | Only cavities facing away from the eye, for untreated parts in place (this depends on the part alone)  |
| Section cut                                                         | Nothing: the cut exposes insides                                                                       |

A part's cavity opens downwards: an eye above the plane of its bottom cannot see into it. The distinct opening planes of a model are few (one per course level), the eye's side of each is checked every frame, and a change of side refills the instance arrays (no rebuild). Orthographic views use the view direction.

**Unchanged:** picking, box/lasso "through" selection, bounds, collision, connectors, Snap together and the path-traced Photo still read the full part geometry from the occurrence handles. The "visible" region selection ID pass draws what the batches draw, so a part enclosed on every side (which cannot be seen) cannot be picked by it either. Captures draw through the batches too: what is left out is inside neighbours or faces away from the capture camera, so images match (tested). `?hiddenCull=0` turns culling off.

## 4. Measurements

Method: `npm run test:stress -- --model city …` (the new plain-brick city, `tests/helpers/brick-city.ts`) and `--model village` (the 20,000-part architectural village), plus a short probe for the phone runs, on the production bundle in headless Chromium with SwiftShader on the shared 4-core ARM VM (load average 11–19 from other jobs during these runs). Desktop is 1440 × 1000; "phone" is the mobile resource profile at 390 × 844, 3× device pixels. "Base" is the same build with `?hiddenCull=0`. Triangle, line and draw counts are exact; milliseconds vary up to 3× between runs of the same build, and SwiftShader wall time is not a phone frame rate.

**The city** is 1,520 parts per block — a 2 × 4 plate base, a solid two-course 2 × 4 brick foundation, four 14 × 14 houses with 12 courses of 1 × N walls in running bond, a plate floor and a plate-and-tile roof — placed on a grid (16 blocks = 24,320 parts; 99 blocks = 150,480).

| City, 24,320 parts                            | Desktop base | Desktop culled |                       Phone base | Phone culled |
| --------------------------------------------- | -----------: | -------------: | -------------------------------: | -----------: |
| Scene triangles (budget count)                |   10,275,200 |  **2,818,816** |                       10,275,200 |    2,818,816 |
| Triangles drawn, orbit from above             |   10,275,200 |  **1,532,800** |                       6.5–7.1 M¹ | 1.28–1.45 M¹ |
| Edge + conditional line segments drawn        |   10,046,410 |      1,433,290 |                        5.0–5.3 M |  1.40–1.55 M |
| Draw calls                                    |           88 |            112 |                         480–560¹ |     680–780¹ |
| Frame CPU, median                             |       3.7 ms |         3.1 ms |                         15–32 ms |     11–17 ms |
| Reduced phone quality (> 4 M scene triangles) |            – |              – | yes (no conditional lines, 1.5×) |       **no** |
| Ready / first frame                           |  2.7 / 3.2 s |    3.0 / 3.5 s |                           11.0 s |  10.1–12.1 s |
| JS heap after load                            |        38 MB |          45 MB |                            37 MB |     43–46 MB |
| Occlusion (per classification)                |            – |          78 ms |                                – |       140 ms |

¹ Phone portrait views have much of the city outside the frame, so the adaptive culling cells are on: fewer triangles, more draws. A culled variant must save 16,384 primitives per bucket (4,096 per cell) to get a draw of its own; without the per-cell rule the phone drew 1,040–1,180 draws for 0.93–1.04 M triangles.

| City, 150,480 parts (147,440 on the phone) |                          Desktop base |       Desktop culled |                                               Phone culled |
| ------------------------------------------ | ------------------------------------: | -------------------: | ---------------------------------------------------------: |
| Scene triangles (budget count)             | 63,577,800: **refused** (budget 60 M) |       **17,441,424** | 17,089,072: refused at 16 M; drawn with a 24 M test budget |
| Triangles drawn, orbit from above          |                                     – |        **9,484,200** |                                                  6.3–6.8 M |
| Line segments drawn                        |                                     – |            8,553,802 |                                                  4.5–4.8 M |
| Draw calls                                 |                                     – |                  115 |                                                    780–870 |
| Frame CPU, median                          |                                     – |            8.4–11 ms |                                      8–42 ms (median ≈ 27) |
| Ready / first frame                        |                                     – | 11.6–12.9 s / 12.5 s |                                                    18–28 s |
| JS heap after load                         |                                     – |           162–164 MB |                                                     160 MB |
| Parts left out entirely (enclosed)         |                                     – |                8,316 |                                                      8,148 |
| Occlusion (per classification)             |                                     – |               382 ms |                                                     987 ms |

These two runs need occurrence limits above today's (desktop 100,000, phone 25,000); they were measured on a local build with desktop 200,000, phone 150,000 and (phone column) a 24 M phone scene budget.

| Village, 20,000 parts (desktop) |                    Base |                    Culled |
| ------------------------------- | ----------------------: | ------------------------: |
| Scene triangles (budget count)  |              10,701,930 |                10,006,246 |
| Triangles / lines drawn, orbit  | 10,701,930 / 10,148,765 | **7,839,208 / 8,093,245** |
| Draw calls                      |                     893 |                       942 |
| Frame CPU, median               |                   54 ms |                   38.5 ms |
| JS heap after load              |                   60 MB |                     69 MB |

The village is mostly windows, doors, arches, slopes, round parts and glass: studs on top of walls are covered, but few parts are closed-shell boxes, so it gains 27% rather than the city's 6.7×. Before substitutes had to pay for their draw, every distinct stud mask was a draw of its own and the village drew 4,148 draws (76.7 ms CPU) for 6.6 M triangles.

**Per part.** A covered 2 × 4 brick draws 18 of 700 triangles and 12 of 696 line segments; a 1 × 2 brick 18 of 172; a 2 × 2 tile 34 of 178 (unit tests). The 150,000-part solid-block occlusion micro-benchmark (1.2 million studs) takes 0.85–1.2 s on the loaded VM with a dense bit grid for the closed-shell cells; with sorted arrays and binary search it took 6 s.

**Images.** Culled and full captures of the city agree to 16 of 307,200 pixels with surfaces only (`tests/browser/hidden-geometry.spec.ts`). With edges, the full drawing also shows outlines of covered studs bleeding through the parts above them at a distance (depth precision), which culling removes: compare `docs/screenshots/hidden-geometry-edges-full.png` and `hidden-geometry-edges-culled.png`.

**Phone target.** A 150,000-part plain-brick city now fits the desktop budget with room to spare (17.4 M of 60 M) where it was refused, and loads on the phone profile when the occurrence limit allows it; seen from above the phone draws 6.3–6.8 M triangles in about 800 draws. That is still six times Minebench's estimated triangle count, because studs that nothing covers — every floor, courtyard and foundation top — are real, visible LDraw geometry. Section 5 lists what would close the rest of the gap.

### Budget changes

- **Made:** the scene-triangle budget counts what the plain view draws after culling (with every downward opening assumed in sight), not the sum of full parts. `render.budget().usage.sceneTrianglesFull` keeps the old figure. The 150,480-part city now passes the desktop budget (17.4 M) instead of being refused (63.6 M).
- **Proposed, not made:** raise occurrence limits to desktop 200,000 / phone 150,000 and the phone scene budget to 24 M, so a 150,000-part plain build opens on a phone. Evidence above: heap ≈ 1.1 KB per part (160 MB at 147,000), phone frames of 6.3–6.8 M triangles in ~800 draws, occlusion ≈ 1 s per classification. Not made here because (a) the occurrence limit is a domain policy in five places (`resource-profile.ts`, `expansion-policy.ts`, `document.ts` ceilings, `scope.ts`, the render budget) with spec §21.2 behind it, (b) views that are not plain (instruction steps, floor focus, layer ghosting, explode) draw neighbour-covered studs again (only cavities facing away are left out: roughly half of the full 63.6 M triangles for this city), which a phone should not be asked to draw until neighbour culling also works against the visible set, and (c) there is no physical-phone measurement yet.

## 5. Techniques considered and not built

- **Chunked static merged meshes.** Minebench's five draws come from merging everything. Here, instancing already keeps the draw count at ~100 for the city (below); merging would give up per-occurrence refills (steps, ghosting, explode) and multiply memory by baking vertices per part. Per-region frustum culling exists as the adaptive cells of the handle rework.
- **Greedy merging of box faces.** After culling, an interior wall brick is 18 triangles; merging coplanar faces of neighbours saves little and would need per-chunk meshes.
- **Distance LOD / low-resolution primitives.** The complete library has 8-segment `8/` primitives (a stud becomes 24 triangles instead of 48). Exposed studs are now the largest remaining cost of plain builds, so compiling phone geometry with `8/` studs would roughly halve what remains; it changes authored geometry, so it needs its own quality setting and cache key. Proposed, not built.
- **Compact load format.** Minebench's MBV4 is 8 bytes per block. Here the 150,480-part city is 275 KB as an MPD (one submodel per city block, placed 99 times; the document keeps that structure). Flattened it is 6.98 MB of LDraw text (46 bytes per part; 533 KB gzipped), and the native project JSON is about 247 bytes per part (24.5 MB for 99,000 parts; 1.9 MB gzipped), with about 530 bytes of JS heap per part for the document alone. A binary placement table (part and colour palette indices, a rotation code and integer positions, ≈17 bytes per part) would cut autosave and recovery copies 15-fold; autosave serialization belongs to the concurrent long-task work, so this is proposed, not built.
- **Phone pixel density.** Minebench caps phones at 1.5× and turns off MSAA. Here the balanced profile allows 2× until a model passes the reduced-quality budget, and MSAA is always on; capping phones at 1.5× would cut fragment work about 44% on 3× screens. Proposed, not built (it changes every phone frame).
