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

## Reproduction and remaining work

```sh
npx tsx scripts/build-arocs-ball-contacts.ts
npx tsx scripts/build-arocs-ball-contacts.ts --check
npx vitest run tests/unit/play-arocs-ball-contacts.test.ts \
  tests/unit/play-arocs-articulation-interfaces.test.ts \
  tests/unit/play-arocs-wheel-interfaces.test.ts --maxWorkers=1
npx tsc -b
```

The generator uses only the pinned local library and unchanged attributed occurrence excerpt; there is no network request. Data is lazy, same-origin JSON. Runtime integration must preserve class-object identity when grouping, reuse these same convex classes for fixed sockets, and pass current plus prediction frames into the policy.

Full source-selected Browser Play admission, mobile ball/socket carriers, coupled spring/steering closure and the other `2736`/`15459`/`32293` contact profiles remain follow-on work. The several source-misaligned Arocs fits documented in the interface review still require an explicit assembly-alignment policy; this packet grants them no exception. The tested axis does not certify an unrestricted articulation range or a complete suspension vehicle.
