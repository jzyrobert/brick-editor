# Source-bound native ball seating checkpoint

The unchanged Arocs excerpt has three reviewed 6628/32005 pairs whose rigid source pivots differ by 1.9804892215, 1.9803807715 and 0.0199962344 LDU. These are authored rest-fit discrepancies, not certified free clearance. The existing coincident ball profile and ordinary entry remain strict; this checkpoint does not admit the full Arocs or publish product eligibility for these assemblies.

`prepareArocsBallRest(source)` reads an explicit spherical-joint declaration:

```ts
restAssembly: {
  profile: "arocs-ball-native-seat-v1",
  ballOccurrenceId,
  socketOccurrenceId,
  socketEndpoint: 0 | 1
}
```

The declaration requests native construction. It is not a successful seating witness. Preflight binds the actual official occurrences, both independently serialized source anchors, complete canonical surface digests and dependency-shadow checks. The observed construction envelope is at most 2.05 LDU. It permits no motor, transmission or authored mating override. This first package requires one isolated joint and two complete singleton body groups; compound or coupled carriers still need their separate source ownership integration. Forged tokens, stale rigs, changed member buffers, asynchronous source edits and substituted anchors refuse before native construction.

`createArocsBallNativeRest(prepared, world, options)` compiles all 607 source-derived convex children into five collision classes before allocating its two bodies. It constructs the spherical constraint with the actual distinct local anchors. The standalone bench uses explicit density 1000; ordinary Play retains its unchanged density 200. Friction 0.7 and linear/angular damping 0.05/0.1 match Play defaults; eight extra solver iterations and CCD are explicit native seating settings. Native constraint stabilization can move the transient bodies. The controller never sets their poses after construction or changes authored source, inventory or rest transforms. This is an ideal native assembly model, without an elastic material stiffness or insertion-force claim.

Only the declared ball core and selected socket core receive the bounded ideal mating allowance while seating. The neck, socket exterior, opposite socket and all foreign colliders remain responding. Once ready, the original 0.05 LDU pivot bound applies. Hook state is computed outside `world.step`; no borrowed native body reads occur in contact callbacks.

Controls must call `requireReady()`. Readiness requires 30 consecutive fixed ticks with pivot residual at most 0.01 LDU, relative pivot speed at most 0.001 m/s, and no foreign penetration beyond the existing 0.001 LDU guard. The native query work is capped at 1024 checks per readiness attempt. Divergence or failure to stabilize within 240 ticks produces `blocked`. A blocked witness remains blocked; retry constructs a new witness after the obstruction is removed. It does not reset the existing bodies in place. Subsequent drift revokes the core allowance and ready control access.

The focused test uses all three unchanged pairs with both an anchored socket and two mobile bodies. All six configurations reach ready with residual below 0.01 LDU, preserve the entire project JSON, LDraw export and inventory, and refuse control access during seating. A hypothetical 0.2 LDU native drift revokes the allowance. A foreign fixed cuboid prevents ready; removing it and constructing afresh succeeds. The ordinary product eligibility check still refuses these native-only declarations.

```sh
npx vitest run tests/unit/play-arocs-ball-native-rest.test.ts --maxWorkers=1
npx tsc -b
```

The five focused cases passed in 10.85 seconds on the shared VM. This is a zero-gravity, two-body native construction checkpoint. Public schema validation, unresolved-rest rejection in the kinematic engine, ordinary session readiness, complete compound carrier ownership, coupled suspension and posed-session reporting remain integration work. Grounded readiness also needs the existing analytic support treatment for the pinned compound/half-space query limitation; this checkpoint does not certify that native query as a ground oracle. The bounded source collision fidelity is the existing [ball profile](AROCS-BALL-CONTACT-PROFILE.md); it is not a complete semantic-solid certificate.

## Existing-body runtime integration

`source.nativeRest` holds the complete sealed preflight roster.
`requireArocsBallRestConstruction(source)` verifies exact source identity,
revision, rig, canonical buffers and every declared joint before any world is
allocated. It grants construction only. Force links, grippers, vehicles, both
bodies fixed, multiple joints and compound ownership remain outside this
isolated profile. Copied metadata or tokens cannot authorize construction.

`compileArocsBallRestCovers` preserves the canonical children in the native
identity-rest body convention. `arocsBallRestMemberSolids` supplies separately
posed group-local covers for walking and mechanical queries. Native bodies
consume the exact sealed cover object rather than inverse-transforming and
rebuilding its hull. All five class identities and all 607 child solids count
against the existing aggregate cap, including anchored classes.

`createArocsBallRestJoint` creates the one actual spherical constraint on the
existing bodies, with both distinct serialized anchors. The state-only
`attachArocsBallNativeRest` bridge creates or deletes no body, collider or
constraint. It refuses foreign-world bodies, missing or copied class covers,
changed collider shapes/anchors, duplicate constraints and substituted fixed
joints. A ready witness does not allow neck, opposite socket, exterior or
foreign contact exclusions.

Ground readiness uses a finite signed-distance check of every retained native
cover support point against each actual transformed HalfSpace, with the same
0.001 LDU guard and a 100,000-point work cap. Other foreign colliders retain
native contact checks capped at 1,024. Disabled colliders and sensors do not
become physical readiness obstacles. The default ground, native contacts and
constraint stabilization remain active. The bridge caches hook decisions
outside the native step.

`DynamicRig` now reports `dynamics.restAssemblies[jointId]` as `seating`,
`ready` or `blocked`, with tick/stability counts, pivot gap, relative speed and
an optional reason. Setters require ready before changing controls; drift
revokes readiness. A blocked assembly requires a fresh source-preserving
construction attempt. Session/Browser construction admission is separate from
this state report.

The ordinary `PlayDynamicsWorld` tests use production density, friction,
gravity and default ground for straight and 37-degree yawed source fits, with
fixed and mobile sockets. Native counts remain three bodies, seven colliders
and one joint, including the existing player and ground. The source assembly
itself has two bodies and five class colliders. Each reaches ready below
0.01 LDU; deliberate transient drift revokes readiness. Real foreign geometry
and a raised real ground prevent readiness. Entire project JSON, LDraw export
and inventory remain unchanged.

```sh
npx vitest run tests/unit/play-arocs-ball-native-rest.test.ts tests/unit/play-arocs-ball-native-bridge.test.ts tests/unit/play-arocs-ball-runtime-seating.test.ts --maxWorkers=1
npx vitest run tests/unit/play-arocs-ball-runtime-seating.test.ts tests/unit/play-dynamics.test.ts tests/unit/play-arocs-ball-mobile.test.ts --maxWorkers=1
npx tsc -b
```

The first batch passed 13 cases in 30.55 seconds before the additional raised
ground runtime case. The second passed all 16 cases, including that case, in
24.65 seconds on the shared VM. These are software correctness measurements,
not phone frame-rate measurements. The source package still covers one
isolated declared pair. Complete coupled suspension, full Arocs ownership and
ordinary full-model mechanical support remain separate work.

## One physical two-ended ball link

The next bounded graph is the actual 32005 occurrence `["n79"]` with its
original 6628 holders `["n53"]` and `["n75"]` at opposite endpoints. It permits
up to two declared spherical constraints, one source socket, distinct ball
occurrences and distinct socket endpoints. Each constraint must have at least
one movable body; a fixed/fixed pair refuses before native allocation even
when the other endpoint is mobile. Every occurrence is still a
singleton physical group; no nearby part, compound carrier, motor, vehicle,
force link or gripper is admitted by this graph.

The two tokens share exactly the same socket cover objects only when their
source, revision, rig, member ID, group, canonical buffers, packet and authored
frame are identical. A copied object or the other ball's cover refuses. The
shared geometry does not share an anchor: each token retains its actual
independently serialized endpoint anchor. The physical socket is constructed
once with three colliders/277 children; each holder has two/330. The graph uses
three source bodies, seven class colliders, two native constraints and 937
aggregate children. Default-ground Play adds its existing player and ground,
so measured native totals are four bodies, nine colliders and two constraints.

Contact allowances union only the two verified paired bearing-core predicates.
A second ball's neck or exterior remains foreign to the first constraint.
Readiness likewise recognizes a paired core through a private registry of
verified native controller closures. Public report objects and copied shapes
cannot publish such an allowance. Disposing a controller removes its private
registration. Both constraints must be ready before a control setter can run;
foreign obstruction or subsequent native drift keeps the whole mechanism
unavailable.

Focused tests verify fixed and mobile shared sockets, a 37-degree yawed mobile
source, real default gravity/ground, a native impulse on the shared link,
foreign obstruction, drift, early control refusal, duplicate endpoint/member
refusal, exact native roster/counts and unchanged entire project, LDraw export
and inventory. This extends the isolated single-pair package; complete coupled
Arocs suspension and full-model source ownership remain separate work.

```sh
npx vitest run tests/unit/play-arocs-ball-link.test.ts tests/unit/play-arocs-ball-runtime-seating.test.ts tests/unit/play-arocs-ball-native-bridge.test.ts tests/unit/play-arocs-ball-native-rest.test.ts tests/unit/native-rest-sources.test.ts --maxWorkers=1
```

The combined five-file batch passed 25 cases in 158.04 seconds on the busy
shared VM, before adding the multi-pair drift assertion. This measures software
correctness and does not establish phone performance.

The final five coupled-link cases, including deliberate native drift, passed
in 54.98 seconds. The final source/foreign gates passed two cases in 21.78
seconds; the added fixed/fixed-pair preflight refusal passed its isolated case
in 8.61 seconds. TypeScript and scoped formatting/diff checks passed.
