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
