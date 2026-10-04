# Hollow housing simulation proxy review

The owner accepted publication of a **bounded simulation proxy** for the pinned
`18940.dat` housing on 4 October 2026. This review records the finite geometry
evidence supporting that decision and its mathematical limits. It does not claim
that the proxy is the unique complete semantic solid represented by the LDraw
surface primitives, or that every physical mechanism acceptance test is complete.

Read this alongside the [original source review](RACK-SOURCE-REVIEW.md) and the
[contact, factoring and native investigation](RACK-CONTACT-ORIGIN-AND-FACTORING.md).
Those documents retain historical rejected constructions and motion checkpoints;
the finalized geometry reviewed here is the **900-region** construction.

## Source and frozen inputs

`18940.dat`, “Technic Gear Rack 1 x 14 with Bottom Beam Housing,” is Philippe
Hurbain's (Philo's) official LDraw UPDATE 2015-02 part, licensed CC BY 4.0. The
review uses its pinned **51-file dependency closure**, including later official
primitive updates. Derived dimensions and geometry below attribute that source.
Original licensed headers and library packs remain unchanged.

| Frozen input                                              | SHA-256                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| Literal `18940.dat`, original line endings                | `3c913080b5efe9412212ee2b6c9745bb9e2af386458c1dd03c008487150796f4` |
| Actual 3,212 compiled source triangles                    | `703ff93710f733b9eb7601742ca5df8d09d0ebd26f9b0be89a85caf0ad152734` |
| Reviewed 900 F64 convex pointsets                         | `68be3f1c17e2b30cb82d09f9ea8a8ae94c1cd64f22cf2bfea1c0fb0b02472414` |
| Shared-lattice projected F32 point packet                 | `8940ed59541e08d6943089abd1e7314a91160278446975fe5f504465c9313adc` |
| Exact projected facets, planar fans and segment endpoints | `eeccb8d61c7ae2e7e4be5a3b2cf8de7c242a8591497469dce8ee4ff43b8d31e5` |

Authored-face ancestry is established for every compiled triangle: zero missing
or ambiguous matches, with maximum literal/compiled matched-vertex displacement
`0.000010844269270244999 LDU`. Literal source semantics and compiled geometry are
distinct references; neither arbitrary winding thresholds nor near-plane grouping
defines positive material.

## Source interpretation retained by the construction

The [oriented material review](RACK-SOURCE-REVIEW.md#oriented-housing-material-review-roof-ribs-and-blind-slot)
establishes the roof/rib and brace joins from authored face orientation and
footprints. Its 79 predetermined material/void controls and all 72 mixed-normal
triangles support the interpretation; they are not whole-solid certificates.

- For `u=abs(Z)` in `(10,14)`, roof/rib side portions at X `-107,-93,-90,97,100`
  and Y `(-11,-6)` are internal union faces. Retain exposed portions above Y
  `-6` and the X `-110` exterior cheek.
- The inner right recess wall is internal through the positive crossbrace:
  X `123` for `2<u<10`, then X `134.5-1.25u` for `10<u<14`. The real brace
  envelope is Y `[-16.55595,-13.63595]`. Preserve the genuine authored tilts on
  main-file lines 195/196 and mirrors 383/384; flattening nearly parallel faces
  would change material.
- The roof underside follows Y `5-2u` over `5<u<8`, transitioning to Y `-11`.
  Rib upper surfaces follow Y `-1.1(u-10)` over `10<u<20` within their actual
  three X footprints.
- The blind half slot is negative on the X>=110 half around XZ `(110,0)`:
  faceted radius 10 over Y `[-49,-11]`, an annular shoulder, a faceted
  radius-8-to-7 throat over Y `[-11,-9]`, and a closing cap at Y `-9`.
  Preserve its wall facets and cap; it is not a through hole.
- Preserve the long rounded windows, backside pockets, five-sided left lip
  notch, lower tooth relief, right recesses and their intervening stops/ribs.
  A negative primitive does not establish a globally empty region where an
  independently reviewed positive union overlaps it.

The corrected constructor retains every positive width, height and event interval.
It removes the earlier positive cutoffs, rounded cut identities and near-end
omissions, carrying shared affine cut ancestry. The sequence is **63,081 cells →
2,473 identical-halfspace cells → 900 convex regions**. The previously omitted
positive-strip witness is inside exact hull 876. These facts do not convert
floating construction or convex coalescing into an exact source-volume theorem.

## Finite source and candidate coverage

Every point of every one of the **3,212 actual compiled source triangles** has a
constructive map into the candidate material union within **0.0012 LDU**. Exact
rational clipping retains every positive projected area. Each convex source patch
maps to identical contained points or exact convex combinations of candidate hull
vertices. Interpolation establishes the bound for all points of each patch.
This is source-facet-to-solid coverage, not source-interior or cavity coverage.

Exact supporting planes and whole-neighbor subtraction produce **12,456
positive-area external candidate polygons**. All are finitely classified, with
zero unclassified residuals. An independent validator checks **46,821 convex maps
and 181,176 vertex pairs**, exact area conservation through all four partition
stages, exact target membership and exact squared distances. The targets are:

| Target of a whole convex polygon                                                                     | Maximum constructive displacement |
| ---------------------------------------------------------------------------------------------------- | --------------------------------- |
| One finite actual source triangle                                                                    | `0.0011905921451817103 LDU`       |
| Different candidate material on/outward of its original facet, across an internal serialization seam | `6.216684946685056e-10 LDU`       |

The partition retains the smallest exact positive areas, including below `1e-17
LDU²`. Search margins identify partitions and never alter the candidate. Target
triangle membership plus convex interpolation proves polygon-interior coverage;
checking only nearest source triangles at polygon vertices would be insufficient.

This is not a boundary Hausdorff claim. For example, an internal ULP-width patch
near `(120,-8.5,0)` lies approximately **2.5 LDU** from any source triangle while
opposite material is nearby. Internal serialization cracks can change the boundary
greatly while their solid displacement remains tiny. No such region was filled
or discarded to obtain this evidence.

## Finite opening and void evidence

All **270 reviewed eroded source-semantic convex cores are nonempty**. Their
**243,000 pairs** with the 900 candidate hulls are exactly disjoint, with zero
intersections. Tests use exact binary-rational halfspaces, separating planes or
exhaustive enumeration of all nonsingular plane triples. A bounded nonempty
polytope has a vertex; exhaustive absence certifies emptiness.

For a nonzero integer outward normal, each probe plane uses
`n.x <= D - 0.0012 * ceil(10^12 * sqrt(n.n)) / 10^12`.
Actual normal erosion lies in **[0.0012, 0.0012000000000012] LDU**. Artificial
axial, chord and triangulation caps erode too. This changes only void probes.

| Packet                            | Reviewed cores and intervals                                                                                                                                                                                                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 41 semantic cores                 | Six faceted through bores with their separate collars; blind half slot and throat; rounded long-window ends; conservative central channel and lower/upper tapered right recesses excluding the complete brace envelope                                                                 |
| 198 negative-profile cap prisms   | All 18 actual `npeghol7.dat` invocations, using their literal bottom-cap footprints and finite transformed depth intervals. Authored axial side tilt is at most `0.00022872534 LDU`, below probe erosion                                                                               |
| 31 additional window/relief cores | All eight backside INVERTNEXT boxes; long rectangular window interiors; the central channel beneath flat/sloped roof faces; actual main147/148/149 backside polygons excluding the genuine brace; five-sided left notch; conservative lower tooth relief; upper-right recess extension |

The long windows retain Y `[-26,-14]` at `u10..18`, Y `[-28,-12]` at `u18..20`
and their rounded half ends. Backside pockets retain their `u14..20` depth and
their positive cheeks at `u10..14`. The notch uses its sloping lower edge rather
than rectangular bounds. The right recess upper extension stops at its actual
Y `-9` cap; the blind slot closes at its separate source cap. These finite cores
provide more evidence than selected void controls, while leaving their precise
conservative-footprint and erosion scope intact.

## Complete projected support retention and native evidence

All **900 pointset IDs and 8,060 matched vertices** survive projection. Exact
local-plus-pose reconstruction equals `fround([x*0.02,-y*0.02,-z*0.02])`; shared
coordinates use the same F32 lattice. Rank changes do not authorize deletion:

| Exact projected affine rank | Regions | Representation                                                      |
| --------------------------- | ------: | ------------------------------------------------------------------- |
| 3                           |     871 | Explicit convex polyhedra with all 6,008 exact supporting facets    |
| 2                           |      26 | Complete canonical planar polygons, represented by 53 fan triangles |
| 1                           |       3 | Complete extreme-endpoint segments                                  |

This retains **927 native children**, including every lower-dimensional support.
Exact-identical point deduplication only remaps face indices. No padding, shrinking
or zero-volume deletion is used. Native reconstruction admits all children and
contains all rank-three centroids; the 102 source/native material/void controls
pass. Admission and selected queries remain distinct from all-point native support.

An independent exact certificate verifies all facet sets, outward cycles, planar
fans, segment endpoints and matched displacements. Convex combinations prove the
F64 and projected mathematical **solid unions** have Hausdorff distance at most
**`0.000005954900140389856910337150 LDU`** in the fixed part frame. This includes
rank collapse and source scaling by exact `1/50`. It does not establish a boundary
bound, source correctness, Rust constructor behavior or rounded world transforms.

Rapier's normalized convex export re-runs a hull calculation; exported vertices
can flatten a thin explicit shape that still retains native interior support.
Direct ray queries on thin regions 790/793 distinguish explicit geometry from
QuickHull. Returned geometry, cached mass volume and boundary `containsPoint`
alone are insufficient evidence. Mechanical travel, contact policy, loading,
backdrive and mobile/world-transform checkpoints are recorded separately in the
[contact investigation](RACK-CONTACT-ORIGIN-AND-FACTORING.md#complete-projected-native-admission-and-motion-checkpoint).

## Frozen proof certificates and reconstruction

These are **private exploratory artifacts**, not committed runtime data or
clean-checkout acceptance tests. Aggregate certificates index their exact stage
hashes, point/plane ancestry and constructive witnesses.

| Certificate                                 | SHA-256                                                            |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `source-facet-coverage-certificate.json`    | `5dca205dfdf90aefdd4209f531c6e400394395ccd1560176912ba1b8f93b98eb` |
| `final-boundary-partition-certificate.json` | `7b967aa86a19b2c74d38183589d6aea92a752617af812660eb8530b3398f78bc` |
| `final-reviewed-void-certificate.json`      | `eb2752e9ee19e09b080bdeeea71d49fc5cf2c6ae0fceab086cc1be814cd65ed6` |
| `negative-core-disjointness-semantic.json`  | `269150f98f296da8e82451c48a1c2c75258cc49c67e5559cc070a029a1820acf` |
| `negative-profile-cap-disjointness.json`    | `857544b2da846d169cf7fad468a0b3ac80fdc7a60b678aef94ce5447e3a23f31` |
| `final-window-disjointness.json`            | `1e166c13eeff03e36c14fe1e8582c42163407514f6ba1e748603017b2e115396` |
| `native-realization-certificate.json`       | `d01f20c92f6c991d1f3376edd21fb7daa04c2629334f64547e4ee7f539ff5f1e` |

The retained review checkout is `/home/ubuntu/brick-editor-housing-review`;
the parent native proof checkout is `/home/ubuntu/brick-editor-physics-motion`.
With the frozen inputs and private helper dependencies present, the relevant
reconstruction commands are:

```sh
cd /home/ubuntu/brick-editor-housing-review
python3 .local/exact-full-hulls.py
python3 .local/source-facet-solid-full-coverage.py
python3 .local/source-residual-owner-coverage.py
python3 .local/source-residual-z-owner-coverage.py
python3 .local/source-residual-zx-owner-coverage.py
python3 .local/source-residual-expanded-owner-coverage.py
python3 .local/full-external-rational-boundary.py
python3 .local/exact-boundary-source-coverage.py
python3 .local/exact-boundary-residual-prisms.py
python3 .local/exact-residual-opposite-solid.py
python3 .local/exact-residual-opposite-solid-final.py
python3 .local/validate-final-boundary-partition.py
python3 .local/negative-core-disjointness-semantic.py
python3 .local/negative-profile-cap-disjointness.py
python3 .local/final-window-disjointness.py
python3 .local/void-core-feasibility.py

cd /home/ubuntu/brick-editor-physics-motion
python3 .local/housing-volume-certifier/certify-native-realization.py
```

The public maintainer constructor is being packaged with the proxy integration
to reconstruct the source-bound geometry and native support packet from pinned
local library inputs. Its finalized entry point and clean-checkout validation
belong to that integration. It is distinct from the private historical proof
pipeline above. This review freezes the accepted input and evidence hashes; it
does not promise that a clean checkout contains the private exploratory witnesses.

## Remaining mathematical and implementation limits

There is no unclassified positive-area outward polygon or discovered intersection
with the reviewed negative cores. The remaining obligations are specific:

1. Complete source-positive material-interior coverage and primitive-union
   ownership across every precision join. Source facets mapping into material
   cannot alone prove those interiors; some source faces are internal union faces.
2. Void regions outside conservative core footprints and within erosion strips.
   Artificial profile triangulation caps leave internal strips even away from
   physical walls. Their eroded union is not the complete intended pocket. Literal
   profile junction gaps and full outer relief contours retain that limitation.
3. A complete closed semantic-solid orientation/topology theorem. Near-surface
   maps cannot alone exclude filled cavities. Two source-normal-opposite ULP maps
   on cell884 remain within the measured surface envelope; this is not an
   orientation theorem.
4. Native all-point support, rounded world pose behavior, physical loads,
   friction/contact policy, blockers, stops and backdrive in integrated fixtures.

Publication therefore adopts a declared, source-reviewed simulation proxy with
these limits. It does not approve arbitrary `0.003` plane merging, positive
interval cutoffs, geometry scaling, lost lower-rank supports or relaxed mechanical
acceptance thresholds. Rendering/export source geometry remains authoritative.
