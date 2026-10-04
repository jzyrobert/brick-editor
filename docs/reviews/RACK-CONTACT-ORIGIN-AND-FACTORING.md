# Rack contact: full origin test and private volume factoring

Measured 2026-10-04 against pinned Rapier 0.21.0 in an immutable diagnostic checkout at `ddd6a90`. These are diagnostic results, not physical rack acceptance or production changes. Both rack Play modes remain unsupported; the required forward, reverse, obstruction/retry, load, backdrive and mobile-carrier acceptance remains open. The isolated translation reproduction in `scripts/audit-rack-contact-translation.ts` does not establish that moving the whole mechanism to the origin fixes it.

The source is the corrected eight-part arrangement described in [RACK-SOURCE-REVIEW.md](RACK-SOURCE-REVIEW.md): 24T pinion, bottom-beam rack guide, slider limits `[-88,+10]` LDU and signed radius `-30` LDU. Library files retain Philippe Hurbain's CC BY 4.0 attribution and were not modified.

## Full native origin comparison

All three cases use the complete original housing and bearings, source gear compounds, native joints, contact hooks and an owned event queue. Only the native rack skin is replaced with the previously sampled/audited **1,245-piece closed-volume candidate**. Its original rack body mass, 1.25561595 kg, is retained with `setMass`; inertia follows the candidate geometry rather than the old skin. This is an approximate simulation mass, not a measured brick weight. There are three native bodies, nine native colliders, 2,730 moving convex children and three fixed member meshes. The complete housing has 3,212 triangles. There is no actor, ground, external blocker or gravity. Character mirrors are not queried in this diagnostic.

Each case commands the pinion to **150° at 180°/s for 900 ticks**, then the rack to **+8 LDU at 40 LDU/s for 900 ticks**, stepping `beforeStep`, `stepPhysics`, `afterStep` at 60 Hz. No motor, target, contact exclusion, source hole or end stop is relaxed.

| Placement                                                         | Forward: pinion ° / slider LDU after 900 ticks | Forward status | Reverse: pinion ° / slider LDU after 900 further ticks | Reverse status |
| ----------------------------------------------------------------- | ---------------------------------------------- | -------------- | ------------------------------------------------------ | -------------- |
| Original source, housing native Y approximately +3.2 m            | 5.049505 / -0.398490                           | blocked        | -14.941156 / 7.812804                                  | complete       |
| Shift every native body by -3.2 m Y after construction            | 4.899844 / -0.396387                           | blocked        | -16.659984 / 8.727997                                  | blocked        |
| Translate all source placements and rig frames before compilation | 5.129869 / -0.388410                           | blocked        | -15.350506 / 7.992738                                  | complete       |

The second case preserves the prepared geometry floats, native joint anchors and mass, but subtracting the decimal shift from an already rounded native housing position leaves a tiny residual origin. The third case adds exactly **+160 LDU to every part placement, group frame and member rest-transform Y before source compilation**. Native joint world frames are consequently constructed at the translated positions, with the housing body at exactly zero. Local anchors, axes, orientations and authored transmission coordinates stay identical. Recompilation changes world-coordinate Float32 rounding, which is why its vertex-buffer hashes differ. Neither approach restores the required forward travel. No floating-origin implementation is justified by these results; loaded tests were not advanced after forward acceptance failed.

Immutable source SHA-256 values:

- `src/play/mechanical-solids.ts`: `be2707fd3307916f363b67e9b50f9898d5b45451b5c35865a7122a72bfcda144`
- `src/play/dynamics.ts`: `3a88d1ce20943c71c3eb03ef4f204b036b1aa1afc218bf6fa1aca4795ee953bf`
- `src/mechanisms/rack-fixture.ts`: `ffa5c4852081b900d7eb989434a59dcdb5cd9a90f2a0f5edc08543c9fd47b007`
- Private 1,245-piece candidate JSON: `51f01244f4af0cc600cc620ef81a5e40f86b872a3cd8f102c4888b4d27f68343`

| Compiled member buffer            | Original source SHA-256                                            | Source-translated SHA-256                                          |
| --------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Housing vertices (9,636 vertices) | `96a94a36a5dd626a5a4112d51e62d60131174b273b693ae0335064d5106ad1b2` | `cf47b6acc31b0f1bd1572603e613711f7165cd566310d10f1a2563ad45454e52` |
| Rack vertices (13,236 vertices)   | `1db2d9138c92150a18b9149073f1f425f3e16ed14238719cf565482d06250427` | `cd826fcf046cafb2ae0be214518a6e8f01331860efc51c54bdc0f933437ac76f` |

Index buffers are unchanged: housing `044d4364f6e3032c86e3f6dc279ae7092e8cd1d18fe4518ac1e38bed0e2531b2`; rack `5736f07bbf305a91ee748ab630a88252f70412c238b3f20d8aab84fbb236dc8d` (4,412 triangles).

Private commands/evidence retained under `/home/ubuntu/brick-editor-contact-diagnostics/.local/`: `npx tsx rack-native-source-placed.ts`, `rack-native-origin.ts`, `rack-native-source-origin.ts` and `rack-diagnostic-input-hashes.ts` (run with the `.local/` prefix). Their matching logs contain full forward/reverse snapshots. Candidate JSON and diagnostic scripts are deliberately not runtime assets or committed clean-checkout acceptance tests.

## Exact factoring is separate and still unaccepted

The three source cross-sections are **not nested**. The outer material outside the middle is about 0.44013453 LDU², and the middle outside the center about 0.000312678 LDU². A 409-piece nested-set simplification was rejected. The replacement Boolean construction retains the common material, middle/core common material, core-only material, middle-only signed bands and outer remainder signed bands. It emits **855 convex prisms**, including the nonnested material rather than erasing it with an epsilon.

Finite polygon checks at each source band report:

| Absolute Z band, LDU | Source material area, LDU² | Factored area error, LDU² |
| -------------------- | -------------------------- | ------------------------- |
| 0–2                  | 8121.590730775199          | -2.00e-11                 |
| 2–8                  | 4222.9925960865985         | -1.05e-10                 |
| 8–10                 | 3623.3702630950984         | -9.46e-11                 |

The maximum area outside the source boundary is 4.55e-13 LDU²; maximum intersection with a source hole is 1.42e-13 LDU². No positive overlap between same-band regions was found. This is a finite section proof, not an engine contact certificate. Private candidate JSON SHA-256 is `f9af3b88e516abacf999fe45778e47efd9817f4f003cd3886af0838ed7b64e64`; evidence is `.local/rack-general-polygon-proof.{json,log}`.

Native admission and native volume remain distinct issues:

- Centering each child before native convex-hull construction admits 851/855 cells. Four mouth-only cells (774, 779, 842, 847), with widths around 1e-5 LDU, still fail. Supplying explicit convex prism topology admits all 855. A native flat compound passes 28 independently calibrated material/void controls, all 32 tooth and 32 following-gap controls, and all 855 prism centroids. These samples do not prove complete native coverage.
- Pure explicit topology has mathematical volume **0.781246041028 m³**, native returned-triangle signed volume **0.781243958651 m³** (error -2.08238e-6 m³, approximately -0.000267%), but native reported collider volume **0.769655514364 m³** (error -0.011590526664 m³, approximately -1.4836%). These are sums over individual native child colliders, avoiding compound summation rounding. Reconstructed native vertices/indices for regular child107 integrate to 0.039730554459 m³, while its reported volume is 0.036033496261 m³. Its returned triangulation differs from the supplied indices but both integrate to the same boundary volume. Thus the large reported-volume discrepancy is not demonstrated source area loss or mere decimal quantization; its native mass-property cause remains unresolved.
- Subdividing only the four failed cells in Z into 64/32/64/32 layers admits **1,043 centered native convex hulls**, preserving their regions. Mathematical volume remains 0.781246041028 m³; summed native reported volume is 0.781227145615 m³ (error -1.88954e-5 m³, approximately -0.002419%). The maximum measured displacement introduced by child-position and local-vertex Float32 conversion is **6.10e-6 LDU**. This bound excludes later body/world rotation and translation rounding. The compiled source also uses Float32; no universal exact-decimal representation is claimed.

Both alternatives still fail the native physical comparison with the complete original housing and unchanged 90°/s authored velocity motor after 180 ticks: 855 explicit prisms give **0.810314° / -0.213630 LDU**, and 1,043 centered hulls give **1.162368° / -0.396464 LDU**. Neither is production support. No global child budget is raised, no nonnested material is discarded, and no guide-wide mating exclusion is added. A complete reviewed hollow housing and successful physical acceptance are still required for a mobile carrier.

The [oriented housing material review](RACK-SOURCE-REVIEW.md#oriented-housing-material-review-roof-ribs-and-blind-slot)
now resolves the roof/rib and crossbrace section branches from the pinned
primitive directions. Roof-side portions within Y `[-11,-6]`, absolute Z
`[10,14]`, are internal unions at the five reviewed rib-side X planes. The
crossbrace's X `123` recess wall is internal over its intervening Y interval;
the omitted X `131` recess-wall segment joins the outer connector beam.
Neither branch is a contour crack to close. Two certified roof-material
controls have winding approximately 0.47, so an uncalibrated threshold would
erase real material. The review also gives explicit positive/negative faceted
blind-slot controls. It does not establish a completed housing compound,
finite whole-housing coverage, native admission, contact acceptance or a
successful mobile-carrier budget.

## Tapered housing candidate: independent rejection

After the oriented material review, private section construction produces closed
contours in all 40 signed Z bands. The seam reconciliation compares the midpoint
and both endpoint reprojected positions; its measured maximum representative
displacement is 0.000503540 LDU. The 79 oriented controls and 22 original controls
all pass section parity. This is diagnostic precision handling, not an accepted
production tolerance or a complete volume proof.

The first lofted housing construction has **5,316 regions**, already exceeding
the aggregate 4,096-child admission cap before other mechanism parts. More
importantly, an independent audit rejects its 3D geometry even though all 101
material/void controls also pass the candidate. Each piece's actual convex hull
is sliced as the weighted Minkowski sum of its lower and upper vertex sets;
interpolating only matching vertex pairs would miss convex fill. Source contours
are separately reprojected and triangulated at five interior fractions per band,
for **200 sampled sections**. Source polygon and triangle areas agree within
1.01e-11 LDU².

| Rejection evidence                                               | Largest sampled value                          |
| ---------------------------------------------------------------- | ---------------------------------------------- |
| Sum of candidate area outside reviewed material                  | 1,088.079503 LDU² at Z −12.625, band [−13,−10] |
| Sum of pairwise candidate overlap area                           | 4,274.577755 LDU² at Z −11.5                   |
| Absolute difference of summed candidate and source section areas | 3,318.338788 LDU² at Z −11.875                 |

For example, candidate piece 118 covers 588.349048 LDU² outside the reviewed
material at Z −12.625. Its hull contains `[-36,-25,-12.625]`, which the reviewed
source section classifies as void; the witness is more than 0.01 LDU from both
source and candidate boundaries. A midpoint-only convex merge does not establish
that the loft remains convex or preserves openings throughout its depth. The
construction must check 3D boundary compatibility before merging, as well as
factor unchanged regions to meet the resource cap. No native trial or production
change is accepted from this candidate.

Frozen input SHA-256 values:

- Candidate pieces: `0b9708efdbeca2dad823a9897dcd6a7038169f2fea0ff0d454cad883c54d3db9`
- Reviewed source graphs: `a5fe467a35fa58e0b4dfa39f08dd9ba0d9031034eafaffcc069d8e9ec1e4b5b9`
- Independent audit script: `359196b7da7ec3045f00414dc98cc0c78f8a05a47db4b7995182d275f3a363e0`
- Audit result: `23629628c9f1bffbb3cd8ae91bada2fb6c5c55acde4cf7b2b51b550673bd2b4f`

Private evidence is in the parent worktree's
`.local/housing-volume-audit-e858a79/`; its audit is
`.local/audit-housing-tapered-volumes.ts`. These counterexamples reject this
candidate. Passing the same sampled audit would still not certify complete
finite coverage, native admission, loaded motion or carrier reaction.
