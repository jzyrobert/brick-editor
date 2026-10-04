# Mechanical contact checkpoint

General joint motion checks static geometry, accepted foreign moving geometry,
and non-mating parts inside the same rig. Commands retain the last accepted pose
and walking proxies when blocked or when safety work exceeds a limit. Time-based
controls can be retried after moving the obstruction. Unwrapped joint arcs and
adaptive subdivision bound each checked surface step to 0.25 LDU; a command may
be refused before moving when it would require over 1,024 segments.

Sharing a rig does not disable contacts. Rigid welds, authored ideal tooth meshes,
and explicit local `mating` bearing cylinders are the allowances. Bearing regions
are split without shrinking their original convex boundary and apply only to
revolute joints or revolute loop closures. Generic translating `mating` metadata remains refused: a rest-tagged shaft
could otherwise ignore a distant frame stop. The separately reviewed 18940/18942
guide has exact paired floor-halfspace/cap volume classes, checked against the
whole current and next carrier-relative rack envelope; it grants no arbitrary
prismatic bearing exemption.
The simple joint editor refuses advanced mating metadata rather than discarding it.

The reviewed 3700/3701/3702 proxies preserve their through bores with sixteen-sided
openings and 0.1 LDU ideal bearing clearance. Studs, underside details and flared
bore mouths remain approximations. Reviewed 3647/3648b gears use
source surfaces merged only when their coplanar convex union preserves area, then
extruded 0.02 LDU inward. Important gear openings and concave tooth spaces survive.
This is a simulation proxy, not a certified fit or a measured weight. Default
density acts on this hollow geometry; authored mass rescales the group but does
not supply measured inertia.

Policy-identical convex children share a flat compound collider. The pinned spur
fixture now uses 18 native colliders and 18 walking mirrors, with 1,924
convex children. A dedicated private query world keeps persistent same-world
colliders; foreign walking handles never enter its collider set. Native hooks
run through an owned Rapier event queue. Calling the pinned wrapper without an
event queue silently omits those hooks.

Before allocating rigs, all active sources share a 4,096 convex-child and 600,000
source-vertex limit. Each member has at most 16,384 input points and each convex
solid at most 256 boundary vertices. Source-surface conversion is limited to
8,192 triangles and 24,576 vertices per member, with bounded merging and clipping
work. All kinematic rigs share at most 512 persistent query colliders, 3,000,000
query vertices and 1,000,000 query triangles. Per command, enumeration and contact
queries each have a 200,000-work limit. Exhaustion refuses motion; it does not
silently simplify a collision boundary or skip a blocker.

Verified checkpoint: actual pinned 8:24 gears rotate with internal contacts;
the pinned pin arm stops at a non-mating frame brick and retries into clear space.
Thin static/foreign blockers, native frame stops, mating persistence, malformed
or translating mating refusal, compound resource refusal and query-pool disposal
have focused unit coverage. The ordinary door fixture retains basic authoring.

Translated and rotated ground planes use signed boundary support rather than the
pinned engine's inverted compound/halfspace distance. A conservative enclosing
box and the complete segment-travel bound certify distant ground; near planes
retain exact support and refinement. Full accumulated-phase/reverse travel and
oblique native axes pass without raising the 256-vertex cap. Parts already
inside an authored revolute bearing cylinder retain their original hull instead
of receiving unnecessary radial cuts. See [verification](VERIFICATION.md#bounded-contact-and-spur-regressions-4-october-2026)
and [measured costs](PLAY-CONTACT-COSTS.md#integrated-spur-after-oblique-admission-4-october-2026).

A complete source-triangle support certificate handles eligible literal Y-axis
rotation on an unchanged carrier. It binds the actual immutable static collider,
its native geometry and pose. A full-turn enclosure supports the lighthouse;
independent root-mounted leaves use their actual unwrapped angular interval,
so walls outside the requested movement do not masquerade as floor contact.
Every candidate triangle must lie outside the invariant axial slab within the
existing 0.001 LDU guard. Unsupported axes, frames, compounds, moving carriers
and unresolved walls keep the normal contact/refinement path. All enclosure
scans and BVH queries consume the existing work limits.

The smooth 60616a door now uses five conservative source-derived covers for its
body, axial pins and protruding handle studs. Whole-part convex filling had
created a false below-floor wedge and a false frame obstruction while closing.
Clipping the actual triangles retains their surfaces without those wedges;
source geometry, inventory, rest transforms and contact defaults stay unchanged.
These are simulation proxies with remaining within-cover concavity filling. See
[source review and blocker/retry evidence](reviews/CATHEDRAL-DOOR-PROXY-REVIEW.md).

The corrected 24-tooth rack mounting and limits have pinned-triangle clearance
checks. Reviewed 18940/18942 native packets now retain 900 housing regions/927
children and 1,245 rack regions, including source openings, supplied supporting
facets and lower-rank support. Both fixed and mobile carriers use the same hollow
geometry. Exact canonical renderer surfaces bind the lazy packets before any
native world/event allocation; changed sources cannot use filename-only support.

The guide-floor tangency correction partitions 414 existing floor-halfspace
regions into a distinct paired bearing class without changing native geometry
or asset hashes. True authored slopes within that halfspace remain. Together
with the original outer Z-cap classes, allowance requires the entire rack to
remain within the reviewed Y/Z corridor (0.05 LDU allowance) and relative basis
error 0.002 at both sweep endpoints. Core stops, foreign assemblies and walking
actors retain response. Default density, friction, effort and the 4,096-child cap
stay unchanged. Fixed/mobile fixtures use 3,657/3,917 children.

Native checks cover actual forward/reverse targets, default-friction load and
obstruction recovery, explicitly authored frictionless passive back-drive and
straight/rotated carrier reaction. Rendered checks cover both modes, exact source
and inventory preservation, linked control feedback and required phone layouts.
The finite source/precision review is a bounded simulation review rather than a
universal source-solid/topology theorem. See [mechanical scope](PLAY-MECHANICAL-FEATURES.md),
[floor review](reviews/REVIEWED-GUIDE-FLOOR-CONTACTS.md), and
[public regeneration](reviews/REVIEWED-PLAY-PROXY-REBUILD.md). Physical-phone
throughput remains unmeasured; cheaper larger-mechanism contact work remains open.
