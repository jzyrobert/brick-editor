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

Private evidence, including the frozen `audit.ts`, is in the parent worktree's
`.local/housing-volume-audit-e858a79/`. These counterexamples reject this
candidate. Passing the same sampled audit would still not certify complete
finite coverage, native admission, loaded motion or carrier reaction.

## Source-plane cell construction and admission checkpoint

Removing the midpoint merges alone does not repair the loft: an unmerged
16,670-triangle construction still adds up to 1,000.794118 LDU² outside source
material in five samples of the worst [−13,−10] band. Matching only corresponding
triangle vertices, instead of slicing their actual hulls, also fails near both
band ends. This isolates two faults: triangulation diagonals change validity
inside a band, and convexifying a warped triangle loft adds further volume.

Reconstructing contour corners from adjacent source planes greatly reduces
these errors but still leaves 13.718926 LDU² of sampled outside area in an
8,600-cell candidate. The subsequent vertical construction intersects source
upper/lower planes, affine X slab planes and Z bounds. Its 30 cells in the worst
band pass all five sampled depths with zero measured outside area or pair
overlap; summed area differs from source by at most 1.82e-12 LDU².

Coalescing cells with identical boundary halfspaces reduces the full construction
from 58,019 to **2,168 cells**. Across 200 sampled slices, all 101 material/void
controls pass. Maximum sampled outside area is 0.003832197 LDU², pair overlap
4.54e-9 LDU², and absolute summed-area difference 0.003754189 LDU². Source-plane
reconciliation is still a diagnostic assumption: near-coplanar grouping and
measured corner drift require a separate bounded precision review. Small area
differences alone do not approve it. The snapshot also exceeds the remaining
1,308-child housing allowance with the currently native-admitting rack candidate.

A bounded private native admission experiment admits **2,119/2,168** centered
housing hulls. The 49 failed microregions have summed mathematical volume
1.2853e-12 m³ and remain retained. Native vertex/child-position Float32 conversion
has measured maximum displacement 5.9437e-6 LDU. Expected total housing volume
is 1.398891848737 m³; the admitted native shapes report 1.398889081056 m³.
This incomplete admission stops the experiment before any fixture target run.
No cap is raised and no physical motion claim follows.

An independent private finite containment tool additionally enumerates exact
quadratic orientation/projection events over depth rather than sampling a grid.
Eleven predicate/root cases pass, including a convex candidate exactly filling
a source hole. It rejects the old piece 118 near Z −12.997738, between the sampled
depths, and conditionally contains old piece 0 over all 52 event intervals. Its
exact decimal test of new vertical piece 0 detects a roughly 1.21e-15 LDU boundary
rounding discrepancy. Rational source-plane ancestry and a separately reviewed
numerical realization are needed before claiming exact construction. Whole-band
source topology, union coverage, native admission and loaded motion remain
independent obligations.

Private parent snapshots: `.local/housing-unmerged-audit-716f3ec/`,
`.local/housing-plane-audit-716f3ec/`, `.local/housing-vertical-audit-716f3ec/`,
`.local/housing-coalesced-audit-716f3ec/` and `.local/housing-volume-certifier/`.
The coalesced candidate SHA-256 is
`ac5915f448d58c6c52bfbc3a8f879ff6a1b06c3ca864d542e8e213046d1e7fc0`.
Native admission evidence remains in the diagnostic checkout's
`.local/housing-native-admission.{json,log}`. These are investigation artifacts,
not committed runtime assets or passing clean-checkout rack acceptance tests.

## Local guide-bearing response and corrected reference

Further convex coalescing reaches **1,099 housing regions**. Native QuickHull
admits 1,079; explicit known-convex faces admit the other 20 microregions without
deleting their material. The private full mechanism then stalls with all ordinary
contacts: forward 900 ticks gives 4.30329°/−0.01714 LDU. Removing surface friction
does not restore travel. The early response identifies a real rack tooth at
Z `[8,10]` touching an outer housing cheek at Z `[10,20]`, with a sideways native
blocking normal despite their interiors being disjoint at ideal guide alignment.

A private local bearing-class trial retains responding core geometry and groups
the housing's 97 negative-Z and 96 positive-Z cheek children separately. Only
cheek/rack pairs whose material interiors meet at the common Z ±10 plane receive
the allowance while cached prismatic transverse/orientation alignment is valid.
Inner end stops and other/foreign pairs retain contacts. With unchanged geometry,
mass and targets, forward reaches **149.9999916°/−78.53984594 LDU** and reverse
**−15.27886356°/+7.99999774 LDU**, both complete after 900 ticks. Shifting the rack
1 LDU off the guide plane disables the allowance: four pair callbacks restore
contact, a 929.962 N event responds, and the first step corrects the offset to
0.291786 LDU. These are private diagnostic results, not accepted production
support; source geometry, loads, back-drive, carrier reaction and both Play modes
still need verification. Logs: `.local/rack-native-bulk-{housing,z-bearing,
z-negative}.log` in the diagnostic checkout.

The independent source review also invalidates extrapolating every midpoint
graph vertex's triangle diagonal throughout its whole band. The parent now
intersects actual source-triangle footprints freshly at all 200 sampled depths,
applying the reviewed roof/rib, crossbrace and tapered crossbrace internal-union
masks. All 200 graphs close; maximum measured diagnostic weld displacement is
0.000503540 LDU. Boundary-family selection and seam handling remain explicit
conditional assumptions. Source triangle SHA-256:
`703ff93710f733b9eb7601742ca5df8d09d0ebd26f9b0be89a85caf0ad152734`.
Private reference: `.local/housing-fresh-footprints-2e26ea5/`.

Literal face ancestry then restores the genuine brace slopes that near-coplanar
grouping had flattened. A **1,007-region** authored-face candidate admits
natively and passes all 101 controls. Its 200 fresh-footprint samples have maximum
outside area 0.002136830 LDU², pair overlap 1.0247e-5 LDU² and summed-area difference
0.001882054 LDU². This candidate is still rejected for complete coverage: the
constructor retains positive width/height cutoffs, rounded cuts and near-end
event exclusions. The review proves an actual omitted microstrip in the earlier
vertical union at `(134.90186320484918,-48,5)`. Its width is only 2.53e-8 LDU,
but the introduced internal boundary is 1 LDU from the actual source surface;
small area/volume error cannot establish a small boundary-displacement envelope.
The next construction must preserve every positive interval using shared source
cut ancestry before coverage approval. No production gate is removed on the
strength of these sampled checks or the bearing trial.

## Positive-interval construction and native export caveat

The next private construction removes positive width/height cutoffs, rounded cut
keys and near-end event exclusions. Shared authored affine cuts produce 63,081
source cells, 2,473 identical-halfspace coalesced cells and **900 convex regions**.
The independent review confirms the previously omitted strip witness lies in
this mathematical union and measures both genuine brace slopes against literal
source faces. These checks repair identified omissions; whole-source coverage
and the finite boundary envelope are still under review.

The parent's fresh-footprint audit of this frozen candidate passes all 101
controls and 200 sampled slices. Maximum sampled outside area is 0.002136830
LDU², pair overlap 5.1883e-7 LDU², and summed-area difference 0.001882054 LDU².
Its reference retains the explicit boundary-family selection and diagnostic
seam-weld assumptions above. Candidate SHA-256:
`68be3f1c17e2b30cb82d09f9ea8a8ae94c1cd64f22cf2bfea1c0fb0b02472414`.
Private parent evidence: `.local/housing-full-audit-8440312/`.

Quantizing source vertices once onto a shared Float32 lattice avoids different
rounding at adjacent child boundaries. A child origin chosen at the geometric
midpoint, clamped into the Sterbenz exact-subtraction interval, recovers all
**8,060 vertices across 900 regions** exactly; shared vertices have
zero disagreement. The maximum part-local lattice displacement is
5.954900129e-6 LDU. This bound excludes source reconstruction, hull topology and
later body/world transformation rounding.

Native hull export is not a direct read of internal convex topology. The installed
Rapier bindings recompute a hull for convex `vertices`/`indices` and
`convexMeshData`; see the
[upstream implementation](https://raw.githubusercontent.com/dimforge/rapier.js/master/src/geometry/shape.rs).
For two thin regions (790 and 793), exported data has only four coplanar vertices
even when explicit faces retain native interior support. The parent's independent
binary-rational reconstruction finds eight and eleven supporting facets,
respectively. Direct native rays through their centroids distinguish explicit
faces from automatic QuickHull: the latter misses the left support by roughly
3.2e-6 m. Explicit-face ray error is zero for both directions in region 790 and
at most 6.13e-8 m in region 793, against exact rational ray clipping. These four
queries are a targeted diagnostic, not a certificate for all native regions.
Boundary `containsPoint` and cached native mass volume are also insufficient
alone for deciding whether a very thin region has been preserved.

The full projected Float32 review finds 871 rank-three regions, 26 planar regions
and three line regions. Exact global binary-rational ownership tests find 46
lower-dimensional vertices outside every rank-three projected convex hull. The collapsed support cannot be
deleted as redundant. A targeted parent native Triangle/Segment experiment
retains the exact vectors for regions 884 and 880, reports the expected zero
volume, contains their centroids, responds to a 1e-7 m sphere contact and refuses
that contact at a 1e-4 m offset. This verifies primitive viability only; the full
projected compound and native motion still require verification. No source
region is deleted based on a zero mass-volume report. The earlier corrected
shared-lattice private bearing trial reaches forward **149.99999316°/−78.53984594 LDU** and reverse
**−15.27886278°/+8.000000715 LDU**. Source/native coverage, loaded back-drive,
carrier response and both production Play modes remain unaccepted; the temporary
rack refusal stays in place.

## Complete projected native admission and motion checkpoint

The full private native realization retains every source region: **871 explicit
convex hulls, 53 triangles and three segments**, for **927 native children**.
Per-cell exact-identical projected vertices are deduplicated before remapping
convex face indices; no coordinate is displaced or source support discarded.
The independent parent reconstruction admits all children; every rank-three
centroid is contained and every rank-three region reports positive native volume.
Their summed native volume is 1.398891642874 m³; the complete compound reports
1.398891568184 m³. This is admission and centroid evidence, not complete native
support or source-volume certification. Frozen exact-facet file SHA-256:
`eeccb8d61c7ae2e7e4be5a3b2cf8de7c242a8591497469dce8ee4ff43b8d31e5`.
Parent evidence: `.local/housing-native-exact-98a2d00/`.

The child's 102 native material/void controls pass, including the formerly
omitted strip witness. With full 1,245-child rack and 1,485-child driver proxies,
anchored total is 3,657; adding the mobile frame's 260 bearing children gives
**3,917**, within the unchanged 4,096 cap. Dynamic forward/reverse each complete
after 900 ticks at **149.99999823°/−78.53982210 LDU** and
**−15.27886356°/+8.000000715 LDU**. The +1 LDU guide-plane negative restores four
responding cheek callbacks and excludes zero, records 1,003.176 N contact and
corrects the first-step Z offset to 0.2582 LDU. The same source-bound geometry in
the private Kinematic query path completes both targets after 180 ticks each:
**150°/−78.53981634 LDU**, then **−15.27887454°/+8 LDU**. Source JSON stays exact.

A correctly refreshed mobile native compound returns force to its carrier and
preserves total X momentum: initial 0.999999999988 N·s, after 30 ticks
0.999998717731 N·s, carrier velocity +0.002373042 m/s. This short impulse witness
does not verify full powered mobile travel or rotated production shape placement.
Load diagnostics slow the motor under a heavy rack. Before the separate slider
repair, the original translation-locked stall/release criterion fails due to
rotational drift.
Extra iterations alone do not repair it. A scoped redundant rotation lock for
an anchored prismatic carrier passes the private release criterion and requires
separate regression/integration checks. Back-drive magnitude remains under
investigation with refreshed native mass/inertia; relation alone is not full
acceptance. No production gate is removed by these results.

The full powered mobile diagnostic subsequently uses actual relative quaternion
and transverse guide alignment. It completes forward/reverse after 900 ticks
each at **149.998606°/−78.538933 LDU** and
**−15.728136°/+8.234209 LDU**, within the existing 0.5 LDU tolerance. Its free
carrier turns substantially (`q=[−0.05915,−0.05034,0.16344,0.98349]`); this does
not reuse the anchored helper's absolute-orientation check. Source remains exact.
Rotated production child positions still require integration verification.

An independent exact finite certificate verifies all 900 matched pointsets and
8,060 projected vertices, all 6,008 complete rank-three supporting facets,
all 26 planar canonical polygons and their 53 fan triangles, and all three
segment endpoints. Convex combinations of matched vertices prove the two
**solid unions** have Hausdorff distance at most
**0.000005954900141 LDU** in the fixed part frame, including rank collapse.
This uses an upward bound on exact squared binary-rational displacements from
source coordinates scaled by 1/50. It excludes boundary Hausdorff distance,
original source-volume correctness, native implementation/query behavior and
rounded world transforms. Private exact check/proof:
`.local/housing-volume-certifier/{native-realization-certificate.json,
NATIVE-REALIZATION-PROOF.md}`.

The canonical-driver private oblique mobile proof also completes both targets:
**150.005256°/−78.544495 LDU**, then **−16.020470°/+8.382545 LDU**. It composes
unchanged canonical driver/rack/housing geometry through the authored 37° pose;
its actual child count is **3,909** (eight fewer posed bearing fragments).
Native coupled angular impulse error is at most 1.90154e-7 kg·m²/s. Current
world-Float32 gear-skin preparation still refuses two regions in this oblique
fixture. Source-bound canonical geometry capture/integration is required; the
successful private canonical replacement does not approve that production path.

A controlled friction-zero, same-mass 1 N·s rack impulse back-drives the pinion
**−13.475581°** with **+7.055887 LDU** rack travel, satisfying the original
magnitude criterion without changing the angle threshold or disabling core
contacts. Default friction strongly opposes the small impulse; force events
identify rack/housing contacts, while post-step cached compound manifolds do not
reveal the active earlier constraints. This verifies ideal coupling in the
explicit frictionless setting. Responding source regions/normals still require
classification before assigning the default resistance to legitimate guide fit.

The source review now certifies every point of all **3,212 actual compiled source
triangles** maps into the candidate solid union within **0.0012 LDU**, using exact
rational clipping and constructive convex-combination witnesses. Every positive
rational projected area is retained. This is surface-to-solid coverage; it cannot
by itself prove material-interior coverage or unfilled cavities. Private reviewed
aggregate: `source-facet-coverage-certificate.json` and
`SOURCE-FACET-COVERAGE-PROOF.md` in the housing-review checkout.

Separate finite void evidence certifies disjointness of all 900 candidate hulls
from **20 reviewed negative primitive cores**, across all **18,000 pairs**:
18 connector/beam bore intervals, blind half-slot 402 and blind half-cone 406.
Each support plane is eroded by at most 0.001200000000000033 LDU; geometry is
unchanged. All pair tests separate or prove exact bounded-polytope emptiness.
This preserves those finite void cores; rectangular windows, other curved
pockets and source semantic union masks remain independent obligations.
Private result SHA-256:
`3994d441d4a7fb490dbae08901d32e7a073a8f874515dce69f171b516c5bf691`.
These certificates do not remove the production rack gate.
