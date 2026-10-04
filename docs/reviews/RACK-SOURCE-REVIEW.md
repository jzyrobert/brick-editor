# Pinned rack and housing source review

This review concerns the collision volume of `18942.dat` and the guide cavities
of `18940.dat`. Coordinates are part-local LDraw units (LDU), before the fixture
transforms. It does not establish native dynamic acceptance or license a contact
pair exclusion. The rendered and exported LDraw source stays unchanged.

## Provenance and method

Both parts are official LDraw UPDATE 2015-02 parts by Philippe Hurbain (Philo),
licensed CC BY 4.0. Their pinned primitive dependencies include later official
updates; the complete pinned dependency closure, rather than an assumed historical
primitive shape, is the reviewed geometry. Derived dimensions below attribute that
source. The literal source SHA-256 hashes, including original line endings, are:

| Part        | SHA-256                                                            |
| ----------- | ------------------------------------------------------------------ |
| `18942.dat` | `520a0f2b01ecb61112cebba1d75d972503930b4add5bf3b8492562087745e686` |
| `18940.dat` | `3c913080b5efe9412212ee2b6c9745bb9e2af386458c1dd03c008487150796f4` |

The review compiles that closure through the renderer's LDraw loader, intersects
triangles with XY section planes, reads literal primitive transforms, and checks
selected material/void points using generalized surface winding. The source has
internal overlapping faces and small closure inconsistencies: winding values are
close to zero or one rather than identically zero or one. Selected controls are
local evidence, not a complete solid-containment proof.

## Moving rack: constant extrusion bands

Every rack vertex lies on one of six Z planes: `-10, -8, -2, 2, 8, 10`.
Every nondegenerate triangle has either a horizontal normal or a normal parallel
to XY; none has both meaningful XY and Z normal components (normalized threshold
`1e-4`). Thus the source has constant XY sections within each absolute-Z band
`[0,2]`, `[2,8]`, `[8,10]`; there is no continuous wall taper within these bands.

A source-derived volume can triangulate each section's closed exterior and holes,
merge adjoining triangles only when their convex union preserves area and holes,
and extrude the corresponding thick band. Section extraction must split
T-junctions, discard redundant collinear edge-intersection vertices, and distinguish
internal source faces from exterior contours. In particular, the central section
also contains open internal web/beam paths; these are not additional holes.

The outer bounds are X `[-139,139]`, Y `[-29,9]`, Z `[-10,10]`. The lower beam
runs approximately Y `[-9,9]`, with the source's faceted radius-9 end caps. The
left end bends down around `(-130,-20)` and extends to Y `-29`. The thin web
between beam and tooth root spans X `[-121,139]`, Y `[-19,-9]`, Z `[-2,2]`,
including the source's rounded right beam junction. The root strip is Y
`[-22.5,-19]`, with its left curved junction reaching X `-121.685`, Y `-23.4443`.
These descriptions guide partitioning; the closed section contour is the authority
for end shapes, rather than a union of bounding boxes.

There are **32 teeth** with centers `c=-112,-104,...,136`. Each tooth is the
convex XY trapezoid `[(c-3,-22.5),(c-1,-27.5),(c+1,-27.5),(c+3,-22.5)]`
extruded over Z `[-10,10]`. Preserve the spaces between teeth. The final tooth at
136 is an explicit separate reference in the source and is easy to miss.

## Rack holes and pockets

All seven circular pin holes run along Z, centered at XY
`(-30,0),(-10,0),(10,0),(30,0),(-110,0),(110,0),(-130,-20)`.
Their core is nominal radius 6 over Z `[-8,8]`, with radius-8 mouths over
`[-10,-8]` and `[8,10]`. The actual pinned circular walls are 16-facet polygons;
smooth circles do not reproduce these wall coordinates exactly.

The four keyed Z-through holes are centered at `(-130,0),(-90,0),(90,0),(130,0)`.
**They are open on one arm and connect to an adjacent recess through the entire
Z depth.** `axlehol4.dat` combined with transformed `npeghol3.dat` or
`npeghol4.dat` forms the complete negative contour. Subtracting a closed standard
cross alone fills an actual passage. The connected positive-side contours have
bounds X `[84,102.48]` and `[117.52,136]`, respectively, Y approximately
`[-6.36391,6.36391]`; the negative-side contours mirror their orientation.
These bounds are not rectangular masks: reentrant cross corners remain material.
For the hole centered at 90, `(97,0,1)` and `(100,0,1)` are void, while
`(93.5,3.5,1)` remains solid.

Side pockets leave a central web Z `[-2,2]` and occupy each outer band
`[-10,-2]` and `[2,10]`:

- Large pockets near X +/-60 have straight spans X `[40,80]` / `[-80,-40]`,
  Y approximately `[-6.364,6.364]`, with rounded negative end contours extending
  to X `[37.52,82.48]` / `[-82.48,-37.52]`.
- Narrow pockets centered at X `-20,0,20`, Y 0 extend X `center +/-2.48`,
  Y approximately `+/-6.36391`.
- The left vertical pocket centered at `(-130,-10)` extends X approximately
  `[-136.36391,-123.63611]`, Y `[-12.48,-7.52]`.

The source contours include the smoothed negative-pocket corners. Carving their
bounds as boxes removes legitimate material; omitting them fills usable pockets.

## Housing guide cavities and stops

The six circular Z-axis holes are centered at
`(-140,0),(-120,0),(120,0),(140,0),(140,-20),(140,-40)`.
They have the same radius-6 core/radius-8 mouth Z intervals as the rack's circular
holes. Neighboring negative-hole primitives supply adjoining recesses; they must
not be interpreted as additional independent round bores.

The long side window spans X `[-60,100]`, Y `[-26,-14]` for absolute Z `[10,18]`,
with radius-6 halfcaps centered at `(-60,-20)` and `(100,-20)`. Its mouth spans
Y `[-28,-12]` for absolute Z `[18,20]`, with radius-8 halfcaps. Primitive placement
midlines at Y `-13` and `-27` are not the actual window walls.

The left tooth groove includes the negative point `(-121,-42.5,6.5)` that a whole
housing convex hull fills. Its upper lip exists in absolute Z `[3,6]`, changes
shape at 6, and contains the notch X `[-126,-114]`, Y `[-39,-33]` in `[6,10]`.
The outer boundary tapers with Z. The lower point `(-121,-47.5,6.5)` is also void;
there is no full-depth rectangular floor at that point. End triangles drawn on
Z +/-10 cannot be extruded across the central cavity indiscriminately.

At the right end, a **blind half-round slot along Y** has center XZ `(110,0)`,
nominal radius 10 on the X>=110 half for Y `[-49,-11]`. It steps to radius 8 at
Y `-11`, tapers to radius 7 at Y `-9`, and closes with a radius-7 cap. This is not
a through pin bore. Its faceted curved wall contributes the actual travel stop;
substituting a rectangular open end changes the stop geometry.

Two right side recesses occupy X `[123,131]`, Y `[-46,-16.5559]` and
`[-13.636,-9]` in absolute Z `[2,10]`. Preserve the intervening crossbrace and
the central Z `[-2,2]` rib. `(127,-25,6)` is void, `(127,-15,6)` and
`(127,-25,1)` are material.

Additional backside pockets occupy absolute Z `[14,20]`; their core cheek over
`[10,14]` remains material. These include X `[-126,-110]`, Y `[-46,-34]`;
X `[-107,-93]`, Y `[-46,-29]`; X `[-107,-93]`, Y `[-26.364,-13.636]`;
and a pocket starting at X `[-90,-70]`, Y `[-26.364,-13.636]` that joins a rounded
negative end contour. Larger recesses have XY polygons:

- `[(-90,-46),(-90,-29),(109,-29),(117,-46)]`;
- `[(117,-46),(109,-29),(109,-11),(117,-11)]`;
- `[(117,-11),(100,-11),(113,-6),(117,-9)]`.

For example, `(0,-40,17)` and `(-118,-40,17)` are void, while the same XY points
at Z 12 are material. A three-plate housing proxy fills these pockets and window
openings. Unlike the rack, the housing has continuously tapered walls; constant
extrusion bands alone cannot reproduce its full source volume.

## Evidence and limitations

The private source harness checked 28 selected rack material/void controls, all
passing: solid winding values `0.88..1.07`, void values `-0.066..0.070`.
Controls include core and counterbore, keyed throat and reentrant corner, thin web
and exterior, large/narrow/vertical pocket, end cap, tooth and tooth gap, and the
32nd tooth. Housing selected controls distinguish window core/mouth, lip/notch,
side recess/crossbrace, backside pocket/core cheek and blind-slot wall/cap.

These findings support a bounded source-derived thick rack volume. They do not
prove that a generated compound covers every source region, that convex unions
preserve all passages, that mass/inertia are correct, or that native contact,
foreign blockers, end stops, backdrive and mobile-carrier response pass. Those
require separate proxy coverage tests and native acceptance. No LDraw pack,
contact solver, collision exemption or Play interface was changed in this review.

## Private thick-section candidate review

A separate private contact prototype generated 1,245 closed convex prisms from
closed XY contours at Z 0.5, 4.5 and 8.5, mirrored across the rack's five signed
bands. It triangulates the exterior with holes, then joins adjoining triangles
only when the convex union preserves their summed area. This candidate is
identified by the SHA-256 of its rack-local LDU point-list JSON:
`51f01244f4af0cc600cc620ef81a5e40f86b872a3cd8f102c4888b4d27f68343`.
The JSON and diagnostic harnesses remain private under `.local/`; this review
commits their findings, not candidate runtime geometry.

Independent finite polygon checks found no proper contour self-intersections,
no inter-hole crossings or nested holes, and no hole vertices outside the
exterior. The central section has 12 closed paths including its exterior;
the other two sections each have 18. Radius-8 mouth and adjoining keyed-recess
bounding boxes overlap slightly, but the actual faceted hole polygons do not.

| Signed Z band | Convex regions | Exterior minus hole area (LDU²) |
| ------------- | -------------: | ------------------------------: |
| `[-2,2]`      |            197 |               8121.590730775199 |
| `[2,8]`       |            263 |              4222.9925960865985 |
| `[-8,-2]`     |            263 |              4222.9925960865985 |
| `[8,10]`      |            261 |              3623.3702630950984 |
| `[-10,-8]`    |            261 |              3623.3702630950984 |

For every band, convex clipping checked every candidate region against the
exterior and every hole, and every potentially overlapping region pair against
each other. The summed region area differs from the section's exterior-minus-holes
area by at most `8.2e-12 LDU²`. A region's measured area outside the exterior is
at most `2.3e-13 LDU²`, and its intersection with holes is at most `1.2e-13 LDU²`.
There are no same-band pair overlaps above the reported `1e-7 LDU²` tolerance.
Together these establish area-preserving coverage of these extracted finite
contours to the stated numerical tolerances. They depend on correct extraction
of all source exterior and hole contours; they are not a universal certificate
for the original source's internal faces or every future source revision.

The 28 calibrated source material/void controls all pass on the candidate.
All 1,245 prism centroids have material-side source winding above 0.5, with range
`0.62949..1.40873`. A further 16,804 occupancy comparisons have zero mismatches:
a grid in all six signed depth bands and points 0.02 LDU on either side of every
nondegenerate source-triangle centroid. This sampling corroborates the finite
section checks and does not replace them.

The prospective `tests/unit/play-rack-solids.test.ts` was copied to a private
test helper with the candidate shapes injected into its prepared rack collider,
without changing production code. A single native `RAPIER.Compound` queried by
`Collider.containsPoint` passes **29 of 29 tests**: 28 individual material/void
controls plus the sweep testing all 32 tooth interiors and following gaps.
This is native geometric containment evidence, not a loaded simulation test.

No near-zero planar pieces were found. Minimum region area is `0.484326 LDU²`
(child 890), minimum transverse width is `0.133581 LDU` (child 301), and shortest
edge is `0.592191 LDU` (child 306); no region area or width is below `1e-3` in its
respective units. Active contact child 1126 has area `2.785967 LDU²`, width
`0.569833 LDU`, and thickness 2 LDU; child 1128 is similar. These measurements
exclude the extremely thin source skins from this candidate, but do not establish
native numerical conditioning under every contact configuration.

A reported post-step deep geometric manifold pairs housing triangle 749 with
rack child 1126. In source-local coordinates, the housing triangle is
`[(100,-26,-18),(-60,-26,-10),(100,-26,-10)]`; its reported witness is on its
window-wall diagonal edge within float precision. Child 1126 lies over rack Z
`[-10,-8]`, whereas the housing triangle lies over Z `[-18,-10]`. At authored
rest these depth ranges only meet at Z `-10`; source probes do not show intervening
common material along the reported witness ray. This cached manifold has zero
reported solver contacts and impulse and cannot establish the cause of the stall.

**Native dynamic acceptance has still not passed.** The full candidate compound
stalls in the private full native fixture while an isolated leaf pair behaves
correctly. Coverage, successful point queries and the deep geometric manifold do
not explain that behavior. Source-derived mass/inertia, loaded motion, foreign
blockers, end stops, backdrive, mobile carriers and contact budget behavior remain
separate requirements before this candidate can be claimed as supported.

## Reproducible translation-sensitive contact probe

Run `npx tsx scripts/audit-rack-contact-translation.ts`. The public diagnostic
compiles the unchanged 3,212-triangle pinned housing and uses the eight
source-derived boundary vertices of rack region 1126. It needs no private
candidate JSON. Two fresh zero-gravity native worlds retain the same mesh,
convex prism, mass, prismatic anchors and velocity motor, with contacts enabled
and CCD disabled. The second world translates both bodies by 3.2 metres in Y.
Neither world uses Play hooks or a compound collider.

On the pinned engine, the origin case's maximum force over five ticks is
`0.000228 N`, with deepest geometric distance approximately `-0.000000745 LDU`.
The translated case reaches `795.52 N` and approximately `-9.499983 LDU`.
Both runs report identical geometry hashes. Native Float32 storage changes the
initial relative Y from `0.4000000059604645 m` to `0.39999985694885254 m`.
Thus this isolated response is sensitive to the common world translation of
the nominally touching guide surfaces. This does not establish a safe clearance
allowance or explain every contact in the complete rig.

The diagnostic reports force events separately from geometric manifold distance,
solver contact count and impulse; cached manifold depth alone remains insufficient
solver evidence. It characterizes the current engine and source geometry rather
than asserting that the defect should persist. No runtime contact exclusion,
origin shift, CCD change or proxy approximation is enabled by this probe.

The optional `--triangle=749` mode retains just that source triangle's three
vertices and indices, removing all other mesh geometry. This independently
reproduces the response: maximum force over five ticks is `0.000110 N` at the
origin and `223.05 N` after the common translation. The translated first tick
reports **three active solver contacts**, summed contact impulse `6.50676 N·s`
and geometric distance `-9.499983 LDU`. Thus this smaller case has actual solver
evidence as well as cached geometry; neither compound grouping nor traversal of
multiple housing triangles is needed to reproduce it. Its geometry hashes also
match between the two translations.

## Housing tapered-volume decomposition analysis

A later independent source audit counts 3,212 housing triangles: 1,618 horizontal,
1,522 parallel to Z, and 72 with both meaningful XY and Z normal components
(normalized threshold `1e-4`), with no degenerate triangles. The source has 21
absolute vertex Z levels, including zero, or 40 signed intervals between levels.
Main structural absolute levels are `0,2,3,5,6,7,8,10,13,14,18,20`.
The additional levels, rounded to the pinned primitive precision, are
`2.6789,3.0616,3.8270,4.9497,5.6568,6.4673,7.0710,7.3912,9.2390`.
They come from the right blind-slot wall and conical throat, localized around
X `[110,120]`, Y `[-49,-9]`; they need not be propagated as global cuts through
the rest of the housing.

With `u=abs(Z)`, six main taper families account for 40 mixed-normal triangles:

| Source boundary         | Affine plane and extent                                               | Triangles, both sides |
| ----------------------- | --------------------------------------------------------------------- | --------------------: |
| Roof underside          | `Y=5-2u`, `u=[5,8]`; footprint changes at 7                           |                     8 |
| Right outer wall        | `X=129-1.2(u-10)`, `u=[10,20]`; lower edge and crossbrace             |                     8 |
| Left lip top            | `Y=-30-(u-3)/17`, X `[-129,-110]`, `u=[3,20]`                         |                     4 |
| Three upper ribs        | `Y=-1.1(u-10)`, X `[-110,-107]`, `[-93,-90]`, `[97,100]`, `u=[10,20]` |                    12 |
| Left lower chamfer      | `Y=-46-(u-10)`, X `[-129,-90]`, `u=[10,13]`                           |                     4 |
| Right inner recess wall | `X=122-1.25(u-10)`, Y `[-46,-9]`, `u=[10,14]`                         |                     4 |

The blind-slot faceted radius-10 wall contributes another 16 mixed-normal
triangles, and its radius-8-to-7 conical throat contributes 16. These are planar
facets of the pinned source; treating the whole stop as one constant XY extrusion
fills or omits functional regions.

All 40 signed-band midpoint intersection graphs were extracted with T-junction
splitting. They are diagnostic graphs rather than cleaned volume contours.
For absolute Z `[2,10]`, internal crossbrace branches remain at XY
`(123,-16.5559)` and `(123,-13.636)`. Bands `[10,14]` contain internal roof
branches, and `[14,20]` expose a roughly `0.000397 LDU` source-coordinate gap near
`(108.3153,-16.5557)`. These cannot be converted into positive regions merely by
assuming every traced path is a hole. Source material semantics and bounded
handling of coordinate precision are still needed.

A private axial-face-paired housing candidate containing 1,017 prisms was also
reviewed. It fails four of 22 calibrated source controls: it fills the left open
lower end `(-121,-47.5,6.5)` and the blind slot `(115,-25,0)`, while omitting the
crossbrace `(127,-15,6)` and curved stop wall `(119.5,-25,5)`. Sixteen prism
centroids lie in source voids. Among 27,424 grid and source-face-offset checks,
1,143 occupancy mismatches occur: 734 overfilled void points and 409 omitted
material points. This diagnostic candidate is not source-faithful.

A finite decomposition using feature-local tapered bands and the reviewed
negative openings is possible in principle because the pinned source boundaries
are planar. No complete accepted positive-volume housing has yet been counted,
and the proposed 4,096-total-source-piece budget remains **unproved**. The rejected
paired candidate's count is not evidence that a complete faithful partition fits.
A candidate must preserve windows, pockets, through holes, the blind-slot throat,
its cap and curved stop, then undergo independent section coverage and native
contact acceptance before becoming supported geometry.

## Oriented housing material review: roof, ribs and blind slot

An independent source-only review on 2026-10-04 resolves the two large graph
branches without using a winding threshold or joining nearby vertices. It reads
the literal pinned `18940.dat` and its 51-file closure, expands primitive matrices
and `BFC INVERTNEXT`, and retains source file/line ancestry for every face. The
literal part hash matches the provenance table above. Expansion gives 1,812
source polygons and 3,212 triangles, agreeing with the renderer audit. Line
numbers below refer to the unchanged literal `18940.dat`, including blank lines.
The derived interpretation attributes Philippe Hurbain's CC BY 4.0 source and
the credited authors of its pinned primitives; no library file was altered.

For an outward-oriented face with normal `n` and a point `p` on it, the local
material side is `n·(q-p)<0`. This is a **local** statement within the face's
authored footprint. It is not an instruction to intersect every source plane:
the source includes internal faces from adjoining partial primitives. Material
joins must first be recognized from their adjoining positive regions and the
negative features they bound.

### Roof/rib union and the apparent 1.875-LDU gap

The two `box2-5.dat` placements on lines 120–121, mirrored on 308–309, supply
roof upper faces at Y `-6` and outer-depth faces at absolute Z `14`. Their X
spans are **`[-90,97]` and `[-107,-93]`**, respectively. They are partial
surface primitives, not complete independent solid boxes. Together with the
inner roof, cheeks and ribs, they establish positive material in Y `[-11,-6]`
over these X spans for absolute Z `(10,14)`. The middle rib spans X `[-93,-90]`.
At the right end, line 199 supplies the Y `-6` face over X `[100,113]` in the same
depth interval; line 143 closes that end region at depth 14. The third rib spans
X `[97,100]`.

The three rib upper facets, lines 93–95 and 281–283, have outward +Y normals
and the plane `Y=-1.1(u-10)`, where `u=abs(Z)`. Their material lies below that
Y plane. Their side faces on X `-107,-93,-90,97,100` extend into the adjoining
roof material. Accordingly, **clip** those side faces at Y `-6` for `10<u<14`:
the portions with `-11<Y<-6` are internal union faces; the portions above `-6`
remain exterior rib faces. Keep the X `-110` cheek exterior. Do not remove the
entire rib side or extend this mask into depths above 14, where the exposed roof
upper boundary changes to Y `-11`.

At section Z `11.5`, the retained diagnostic graph's X `-107` branch consists
of triangle 182 over Y `[-6,-6.75]` and triangle 183 over `[-6.75,-7.875]`.
Both intervals are internal. At Z `13.5`, the corresponding intervals are
`[-6,-7.75]` and `[-7.75,-10.375]`, also internal. Their 1.875-LDU and
4.375-LDU branch lengths are geometry from the source triangulation, not cracks
to be welded or contour edges to be closed.

The following independently chosen controls demonstrate why threshold 0.5 would
be wrong. Both points of every row are material by the roof/rib union; the
reported winding merely diagnoses the nonmanifold surface representation.

|    Z |       Y | Material point left of X `-107` / winding | Material point right of X `-107` / winding |
| ---: | ------: | ----------------------------------------- | ------------------------------------------ |
| 11.5 | -7.3125 | `(-107.01,-7.3125,11.5)` / 1.457697       | `(-106.99,-7.3125,11.5)` / 0.469743        |
| 13.5 |  -6.875 | `(-107.01,-6.875,13.5)` / 1.457231        | `(-106.99,-6.875,13.5)` / 0.467151         |
| 13.5 | -9.0625 | `(-107.01,-9.0625,13.5)` / 1.477809       | `(-106.99,-9.0625,13.5)` / 0.488222        |

Additional controls on both sides of all five masked X planes, at these three
section coordinates, establish the same material interpretation. Conversely,
`(-107.1,-5,11.5)` is rib material and `(-106.9,-5,11.5)` is void: above Y `-6`
the rib side must remain. Controls at rib upper facets use Y `T(u)-0.05` as
material and `T(u)+0.05` as void at X `-108.5`, for depths `11.5,13.5,16,19`.
This preserves the real rib slope and distinguishes its upper void.

### Crossbrace union and the apparent 2.91991-LDU gap

The long X `123` face on lines 188/376 points toward +X, so its material lies
to the left; it is the inner wall of the two right recesses. The X `131` faces
on lines 200–201 and 388–389 point toward **-X**, so their material lies to the
right in the outer connector beam. They are opposing recess walls. Their gap
over Y approximately `[-16.55595,-13.63605]` is the intervening positive
crossbrace's internal join to the beam, not a missing exterior wall.

For `2<u<10`, clip the long X `123` face at Y `-16.5559` and `-13.636`:
discard its intervening portion as internal material, retaining its portions
within the two recesses. The brace occupies X `[123,131]` over this Y interval
and joins positive material on both sides. Do not invent a cap at X `131` or
close the brace interval into another hole. The slight endpoint discrepancies
between literal end facets and transformed rectangles remain the separately
recorded coordinate-precision issue.

At depths `3,6,9`, X `122.9,127,130.9,131.1` with Y `-15` are all material.
X `127`, Y `-25` at those depths is void. In particular, the winding at
`(130.9,-15,6)` is 0.945511 and at `(131.1,-15,6)` is 0.948407; these two
positive controls corroborate the source-oriented join. Treating the latter
point as exterior would reverse the recess-wall semantics.

For `10<u<14`, the inner recess wall changes to X `134.5-1.25u`, with material
to its left. The crossbrace's outer wall changes to X `141-1.2u`, also with
material to its left. The intervening brace remains positive; the long inner
recess wall is internal within the brace's Y interval. Above depth 14, the brace
continues through the authored polygon on lines 167/355 and its two slightly
sloping Y sides on 195–196/383–384. Preserve their literal source edge equations;
they include the previously recorded roughly 0.000397-LDU endpoint discrepancy.

### Faceted blind slot: positive wall and negative throat

Lines 402–409 describe one blind negative feature, not separate positive
cylinder/cone solids. The inverted radius-10 half-cylinder runs along Y from
`-49` to `-11` on the X≥110 half. Its facet normals point into the slot; material
lies outside its pinned polygonal wall. In the positive-Z quadrant the outer
XZ wall vertices, relative to `(110,0)`, are `(10,0)`, `(9.239,3.827)`,
`(7.071,7.071)`, `(3.827,9.239)`, `(0,10)`; negative Z mirrors them. These
segments, rather than a circular radius test, define X as a piecewise affine
function of Z.

At Y `-11`, `2-4ring4.dat` scales its inner radius 4 to 8 and outer radius 5 to
10; the annular shoulder is positive material. The inverted `2-4con7.dat` maps
its radius-8 ring to Y `-11` and radius-7 ring to Y `-9`. Material lies outside
its eight pinned planar quadrilateral facets. Retain their supplied vertices
and triangulation; an ideal cone equation would change the faceting. The
radius-7 disc at Y `-9` has outward normal -Y: it closes the negative slot, with
material on its +Y side.

At Y `-25` and Z `0,5,8`, wall X values are `120`, `118.455071516646`,
`115.680928044280`, respectively. Points 0.05 LDU to their +X side are material;
points 0.05 LDU to their -X side are void. Additional controls are:

| Feature               | Material         | Void             |
| --------------------- | ---------------- | ---------------- |
| Blind cap             | `(115,-8.95,0)`  | `(115,-9.05,0)`  |
| Shoulder and throat   | `(119,-10.95,0)` | `(117,-10.95,0)` |
| Cone at its halfway Y | `(117.55,-10,0)` | `(117.45,-10,0)` |

The wall, shoulder, cone and cap controls have material winding `1.03..1.09`
and void winding `0.03..0.09`. Their classification was chosen from primitive
orientation and feature bounds before computing winding. They preserve the
curved stop and its tapered throat rather than filling or opening the slot.

### Coverage of tapered boundary interpretation and remaining work

All 72 mixed-normal source triangles are accounted for by the six structural
taper families and the two blind-slot families. The material-side directions
are now reviewed:

| Boundary                     | Local material side, within authored footprint |
| ---------------------------- | ---------------------------------------------- |
| Roof underside               | `Y >= 5-2u`                                    |
| Right outer end/brace        | `X <= 141-1.2u`                                |
| Left lip top                 | `Y <= -30-(u-3)/17`                            |
| Upper ribs                   | `Y <= -1.1(u-10)`                              |
| Left lower chamfer           | `Y >= -36-u`                                   |
| Right inner recess wall      | `X <= 134.5-1.25u`                             |
| Blind-slot cylinder and cone | Outside each source faceted negative wall      |

These directions are local boundary interpretation, with internal union masks
applied where described above. They are not a complete housing partition or a
certificate obtained by intersecting all seven rows.

The private evidence is in
`/home/ubuntu/brick-editor-housing-review/.local/material-review.{py,json,log}`.
It contains the 1,812-face source expansion with reviewed face ancestry and 79
explicit material/void controls, including 30 positive controls on both sides
of the roof/rib internal planes. No threshold was used to choose those controls.
The private JSON SHA-256 is
`bda0815c8285b62a1c42fbc6e63153a15b2ee38956def7859bd7c911dd4d11d2`;
the source-expansion script SHA-256 is
`091aff0fbba0d508fab9f420c0d7b1597ee9e973c33f70442950994339249138`.
The source-edge graphs supplied by the previous review remain in
`/home/ubuntu/brick-editor-rack/.local/housing-contours-source-edges.json`.

The roof and brace branches are resolved at the feature level. The small
primitive/fill-face endpoint discrepancies, independent finite section coverage
of a complete candidate, native child admission and the total child count remain
to be established. Under the current 4,096-child limit, the measured mobile
assembly with 1,043 rack children, 1,485 gear/shaft/bush children and 260 bearing
children leaves **1,308 housing children**, not 1,500. No housing candidate has
yet demonstrated faithful coverage within that capacity. None of this source
review establishes loaded dynamic rack acceptance.
