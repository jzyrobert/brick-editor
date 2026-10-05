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

`createArocsBallNativeRest(prepared, world, options)` compiles all 607 source-derived convex children into five collision classes before allocating its two bodies. It constructs the spherical constraint with the actual distinct local anchors. Dynamic density 1000, friction 0.7 and linear/angular damping 0.05/0.1 match Play defaults; eight extra solver iterations and CCD are explicit native seating settings. Native constraint stabilization can move the transient bodies. The controller never sets their poses after construction or changes authored source, inventory or rest transforms. This is an ideal native assembly model, without an elastic material stiffness or insertion-force claim.

Only the declared ball core and selected socket core receive the bounded ideal mating allowance while seating. The neck, socket exterior, opposite socket and all foreign colliders remain responding. Once ready, the original 0.05 LDU pivot bound applies. Hook state is computed outside `world.step`; no borrowed native body reads occur in contact callbacks.

Controls must call `requireReady()`. Readiness requires 30 consecutive fixed ticks with pivot residual at most 0.01 LDU, relative pivot speed at most 0.001 m/s, and no foreign penetration beyond the existing 0.001 LDU guard. The native query work is capped at 1024 checks per readiness attempt. Divergence or failure to stabilize within 240 ticks produces `blocked`. A blocked witness remains blocked; retry constructs a new witness after the obstruction is removed. It does not reset the existing bodies in place. Subsequent drift revokes the core allowance and ready control access.

The focused test uses all three unchanged pairs with both an anchored socket and two mobile bodies. All six configurations reach ready with residual below 0.01 LDU, preserve the entire project JSON, LDraw export and inventory, and refuse control access during seating. A hypothetical 0.2 LDU native drift revokes the allowance. A foreign fixed cuboid prevents ready; removing it and constructing afresh succeeds. The ordinary product eligibility check still refuses these native-only declarations.

```sh
npx vitest run tests/unit/play-arocs-ball-native-rest.test.ts --maxWorkers=1
npx tsc -b
```

The five focused cases passed in 10.85 seconds on the shared VM. This is a zero-gravity, two-body native construction checkpoint. Public schema validation, unresolved-rest rejection in the kinematic engine, ordinary session readiness, complete compound carrier ownership, coupled suspension and posed-session reporting remain integration work. Grounded readiness also needs the existing analytic support treatment for the pinned compound/half-space query limitation; this checkpoint does not certify that native query as a ground oracle. The bounded source collision fidelity is the existing [ball profile](AROCS-BALL-CONTACT-PROFILE.md); it is not a complete semantic-solid certificate.
