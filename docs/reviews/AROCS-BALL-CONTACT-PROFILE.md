# Source-faceted Arocs ball contact profile

This checkpoint supplies a bounded native collision profile for the source-coincident `6628.dat` ball and `32005.dat` steering-link socket. It does not yet make the whole 42043 suspension playable. The wheel/carrier and other ball-family interfaces remain separate source-connection reviews.

The original Arocs occurrence excerpt is attributed in [the ball-interface review](AROCS-BALL-LINK-INTERFACES.md). Original LDraw files, occurrence matrices, project revision, inventory and authored export are preserved. Generated contact data retains William Howard's ball source attribution (CC BY 2.0/4.0) and Donald Sutter's steering-link attribution (CC BY 4.0), plus the pinned root and dependency-closure hashes. Library headers are never edited.

## Geometry and contact contract

The actual rendered ball supplies 66 distinct vertices on the source's faceted radius-8 sphere. Its convex core replaces only source skin pieces contained by that faceted hull; 329 remaining neck/pin skin pieces are retained. This uses the source facets instead of a smooth radius-8 sphere.

The steering link retains all 245 inward source-face skin pieces. Each socket end has a separate core class consisting of complete pieces whose vertices lie within 12 LDU of that endpoint. The remaining pieces remain an exterior class. Each end also receives 16 convex positive-material sectors between its actual source radius-8 and radius-10 polygon rows, spanning local Y −6 to +6. These are a subset of the literal tube material: `s/32005s01.dat` declares the radius-10 outer cylinder, radius-8 internal quarter-cylinder walls and end rings. The smaller conical throat and retention tabs remain in the original source skin; the sectors fill neither the radius-8 void nor the neck opening.

The complete classes contain:

| Member | Native children per class                        | Total |
| ------ | ------------------------------------------------ | ----- |
| 6628   | faceted ball 1, neck/pin 329                     | 330   |
| 32005  | first socket 129, second socket 132, exterior 16 | 277   |

The resulting five flat collider classes account for all 607 native children under the existing aggregate 4,096-child admission cap. Native convex inputs remain below the existing 256-point limit. Source skin thickness is the existing 0.02 LDU approximation. Default proxy density, mass and inertia are simulation approximations, not measured LEGO weights. This is not a complete semantic-solid or topology theorem.

The sole ideal bearing allowance is the paired faceted ball core against its actual socket core. It represents elastic socket retention and removes their intentional internal mating response. The spherical constraint keeps the actual source pivots coincident. The neck, socket exterior, other socket endpoint and all foreign geometry retain native contact response. Every current and predicted frame must keep the pivots within 0.05 LDU; drift outside that envelope restores response. No angular clamp, motor, whole-member exclusion or whole-rig exclusion is added.

## Binding and native evidence

`loadArocsBallContacts()` binds the generated packet to actual canonical occurrence surfaces, namespace, occurrence IDs, revision, frames and typed-buffer identity before native worlds are created. Full dependency-name shadowing is refused. A direct synchronous consumer without successful preflight refuses rather than falling back to a whole-member hull. Source-paired spherical joint IDs are exposed only as narrow internal eligibility witnesses; they do not authorize other joints or the rest of an assembly.

The focused native tests use an actual coincident source pair and spherical constraint at 1/60 second, zero gravity, default collider density/friction and a declared 0.0002 N·m hand torque. Owned event queues and real contact hooks remain enabled. Both original and translated/37° oblique poses:

- rotate beyond 24° and stop before 32° through responding neck/socket geometry;
- settle below 0.001 rad/s and reverse to the corresponding negative stop;
- stop earlier, between 8° and 20°, at a genuinely foreign cuboid;
- resume at least another 8° after the cuboid is removed;
- keep native pivot drift below 0.05 LDU and preserve the complete project and inventory.

The tests also retain both socket ends, refuse changed canonical geometry and dependency shadows, restore response for either current or predicted misalignment, and refuse aggregate child exhaustion without publishing partial bindings.

## Integrated entry and mobile carrier checkpoint

The runtime now consumes these same classes through mechanical preparation, moving/stationary reuse and native fixed/moving body construction. Class identity survives grouping, so core mating never becomes a whole-member exclusion. Ordinary eligibility requires the exact fourth `PlayMechanismSource` argument after successful preflight. No source, an unbound source, a cloned/stale source, or an extra disconnected member in a compound body refuses admission.

`play-arocs-ball-mobile.test.ts` exercises the real `PlaySession.create` path and `DynamicRig` path in the authored and translated/37° oblique poses with **both** source bodies mobile. It verifies the five classes/607 children, source/export/inventory preservation and two mobile body reports. A controlled zero-gravity momentum witness retains default proxy geometry/density, declares a 1 N·s impulse and zero damping, and explicitly wakes both bodies each tick: native sleep otherwise intentionally discards subthreshold velocity. Total linear momentum remains within 5×10⁻⁶ N·s while the carrier responds. A separate declared 0.2 N·m hand-torque witness begins from zero velocities, retains native constraints and contacts, and rotates the mobile carrier by more than 0.001 radians while pivot drift stays below 0.05 LDU. These controlled bench settings do not change product defaults or assert real LEGO mass/hand-force values.

The two source-profile suites pass 11 checks, including the seven fixed-profile/binding/eligibility cases and four integrated mobile cases. Rendered Browser capture and complete suspension/steering systems remain separate acceptance work.

## Noncoincident source-fit diagnostic

A private, unaccepted 18-run native matrix uses three actual `6628`/`32005` source fits whose authored gaps are 0.043680659, 1.941648784 and 1.980380771 LDU. It retains actual canonical shapes and source poses and creates native spherical constraints with **distinct actual ball and socket anchors**. No body translation/reset or authored source edit is applied. Fixed/mobile socket cases compare all contacts, the existing 0.05 LDU allowance after seating, and an explicitly diagnostic paired-core elastic allowance from the initial state; neck, exterior, other-end and foreign contacts continue responding.

All three native joints correct the residual, including first-step native position stabilization. This is not evidence of initial free clearance or a measured physical elastic insertion. The initial paired-core elastic diagnostic settles mobile cases to gaps below 0.000024 LDU and sleeping bodies after 240 ticks. Enabling the core allowance only after the existing small alignment gate can leave mobile cases with final speeds up to 1.474 m/s; ordinary all-contact cases can also retain substantial motion. These transients prevent treating a small final anchor residual alone as assembly acceptance.

This diagnostic grants no production exception. `arocsBallJoint`, profile preflight and ordinary eligibility still refuse noncoincident fits. A follow-on must explicitly bind the actual source connection, declare assembly settling, preserve real neck/outer/foreign contacts, bound the correction and prove coupled-body/world behavior. Current native joint construction derives its second anchor from the first world point; a future source-settling path must carry both actual anchors rather than silently relocating the second feature. Saved source/export remain unchanged throughout the diagnostic.

## Reproduction and remaining work

```sh
npx tsx scripts/build-arocs-ball-contacts.ts
npx tsx scripts/build-arocs-ball-contacts.ts --check
npx vitest run tests/unit/play-arocs-ball-contacts.test.ts \
  tests/unit/play-arocs-articulation-interfaces.test.ts \
  tests/unit/play-arocs-wheel-interfaces.test.ts \
  tests/unit/play-arocs-ball-mobile.test.ts --maxWorkers=1
npx tsc -b
```

The generator uses only the pinned local library and unchanged attributed occurrence excerpt; there is no network request. Data is lazy, same-origin JSON. Runtime integration must preserve class-object identity when grouping, reuse these same convex classes for fixed sockets, and pass current plus prediction frames into the policy.

Full rendered Browser acceptance, coupled spring/steering closure and the other `2736`/`15459`/`32293` contact profiles remain follow-on work. The several source-misaligned Arocs fits documented in the interface review still require an explicit assembly-alignment policy; this packet grants them no exception. The tested axis does not certify an unrestricted articulation range or a complete suspension vehicle.
