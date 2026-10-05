# Native angular equation kernel

[AngularEquationSolver](../../src/mechanisms/angular-equations.ts) implements signed two- and three-port angular constraints through pinned Rapier bodies. It is a runtime kernel for a separately reviewed source graph, not a way to admit arbitrary joints or power an unconnected mechanism. The source geometry/admission evidence remains in [TECHNIC-DRIVETRAIN-INTERFACES](TECHNIC-DRIVETRAIN-INTERFACES.md).

Each port binds an actual native shaft body, its carrier and a unit axis in that carrier's native local frame. It measures the relative quaternion twist from the bodies' original rest rotations, unwraps the actual coordinate, and reads `(omegaBody-omegaCarrier) dot worldAxis`. Equations enforce `sum(coefficient*relativeRadians)=phaseRadians`. For each port, its shaft gets the weighted angular Jacobian and its carrier gets the opposite Jacobian. Contributions to the same native body are merged before computing effective inertia and applying impulses. A differential can therefore return reaction to its case, with independently moving sides/spider; a bevel pair can return a reaction about both orthogonal axes to a mobile carrier.

The solver reads Rapier's effective world inverse-inertia tensors, including locked degrees of freedom. It applies torque impulses only. It never sets body rotation, translation or velocity. Loads propagate through the actual inertia back to an effort-limited motor; a blocked output can stall the input. Neutral disables the equation and leaves both bodies free. On engagement, the caller supplies the newly source-reviewed indexed phase rather than teleporting either member into alignment. A conditional change invalidates previously prepared phase/Jacobian data.

## Runtime hook and finite work

Construct `new AngularEquationSolver(ports, equations)` after the actual native bodies/joints exist. The caller must bind bodies from the same world and actual revolute interfaces. Axes must be unit length to 1e-8; normalize a source-rounded direction locally as the native joint does, retaining the original source/rest placements. Angular coordinates are radians, reaction torque is N·m, and time is seconds.

For the existing mixed angular/rack loop:

```ts
solver.beginStep(dt);
for (let pass = 0; pass < 8; pass++) {
  for (const transmission of transmissions) {
    if (transmission.kind === "rack") solveExistingRack(transmission);
    else solver.solveEquation(transmission.id);
  }
}
```

`solvePass()` handles all angular rows once; standalone `solve(dt)` performs eight passes. `setEnabled(id, enabled, reviewedPhaseRadians?)` changes a conditional equation before the next `beginStep`. `snapshot()` returns measured coordinates/speeds and the applied impulse/cap state without advancing measurement.

Work is bounded at 300 ports, 100 equations, two or three distinct terms per equation, and eight solves per equation per tick. Coefficients must be finite, nonzero and between 1e-6 and 256 in magnitude. A 0.8 Baumgarte phase correction is capped at the existing 3,600°/s transmission correction speed. Coordinate observations refuse jumps above the existing 60° fixed-step limit. A per-equation cap bounds each body's net reaction to at most 10,000 N·m by default (a caller can select a lower positive cap); the accumulated impulse is bounded across all passes, not separately reset on each pass. This is a declared ideal constraint reaction limit, not a material strength model or motor rating. No source part, mesh, contact allowance or collision budget changes.

## Evidence and practical limits

`DynamicRig` now converts its existing physically admitted spur rows into this
kernel after creating the actual native bodies and joints. Rack rows retain
their original positions inside all eight mixed iterations. This changes no
source admission or collision representations. Twenty-two existing integrated
spur/rack/kinematic tests pass, including multi-turn control, output backdrive,
heavy-load response, obstruction/release and mobile-carrier momentum. A separate
six-decimal source-rotation case verifies locally normalized native axes while
retaining the original serialized group frames and source data. Extended
worm/bevel/differential source assemblies still require their runtime admission.

The source-based tests derive actual signed worm/bevel ratios from the attributed original excerpts and apply those signs in pinned native impulse responses. Independent kernel tests use spheres with analytically known inertia to assess physics without duplicating the solver's inverse-inertia calculation. They check output-to-input backdrive, dissipation at zero phase error, sustained-load stall/release, multi-turn measured motion, mobile orthogonal carrier reaction and total angular momentum, three-port differential response and free splitting, neutral isolation, bounded engagement impulses, mixed equation ordering, moving-carrier relative coordinates, and resource/unsupported-observation refusals. These isolated inertia benches do not claim actual complete-model mounting or collision acceptance.

```sh
npx vitest run tests/unit/angular-equations.test.ts tests/unit/drivetrain-interfaces.test.ts tests/unit/drivetrain-routing.test.ts --maxWorkers=1
npx tsc -b
```

The current focused slice has nine native kernel checks and thirteen source/interface checks. Common rigid rotation produces only native quaternion/feedback roundoff in relative motion; the focused velocity bound is explicitly `8*2^-23*(0.8/dt+1)` rad/s, independent of source seating/contact tolerances. Phase feedback can add small correction work after numerical drift; this is not an exact energy-conservation theorem for all steps. Worm self-locking, friction, gear elasticity, selector shifting under load and arbitrary operating-phase tooth clearance are not inferred. Complete source assemblies, internal-part rendering/collision, native world/load acceptance of each extended family and flexible systems remain separate obligations.
