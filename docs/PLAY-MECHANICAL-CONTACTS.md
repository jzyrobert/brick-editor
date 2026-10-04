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
revolute joints or revolute loop closures. Translating bearing allowances are
refused because a rest-tagged shaft could otherwise ignore a distant frame stop.
The simple joint editor refuses advanced mating metadata rather than discarding it.

The reviewed 3700/3701/3702 proxies preserve their through bores with sixteen-sided
openings and 0.1 LDU ideal bearing clearance. Studs, underside details and flared
bore mouths remain approximations. Reviewed 3647/3648b gears and 18942 rack use
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

The corrected rack mounting and limits have separate pinned-triangle clearance
proof. **Its native compound contact path still stalls at near-tangent guide
surfaces, so physical rack acceptance is open.** A moving 18940 rack housing is refused before allocation until its hollow proxy is reviewed; anchoring the frame retains its exact surfaces. Earlier same-rig-disabled rack
travel proves ideal coupling only. Internal-edge flag experiments and source
volume decomposition are diagnostic work, not verified runtime behavior. Phone
hardware performance has not been measured; VM measurements belong in the
benchmark record after the final proxy geometry is accepted.
