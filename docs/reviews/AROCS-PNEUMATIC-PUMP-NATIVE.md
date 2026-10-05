# Actual Arocs pump source and native pressure checkpoint

This bounded native bench consumes the real four pump source owners from
Philippe Hurbain's [42043-1 OMR model](https://library.ldraw.org/library/omr/42043-1.mpd).
It does not yet admit a complete mounted pneumatic mechanism to ordinary Play.
Original model SHA256:
`6264ccf8fd18d666b68c4538eb69ddfbd87fe5bf633ebf34395b48229e9fc369`.
The seven-owner excerpt retains the original local placements, colours and
embedded CCAL2.0 source headers. The stopped axle and two collars are additional
source owners, not new geometry or an inferred chassis weld.

## Source ownership and visible geometry

`prepareSourcePneumaticPump` binds the exact project/revision/source records,
resolved dependency closures and actual canonical triangle surfaces. Its four
owners are the embedded stepped `42043 - 2943-v2.dat` base, `99799.dat` barrel,
`2941.dat` cap and `2944.dat` rod. Together they have 1,533 rendered source
triangles. Copied tokens, substituted source/dependencies, stale projects and
altered surfaces refuse. The manifest also binds the pinned `99798-f1.dat` and
`99798-f2.dat` shortcut definitions. Their actual factory composition places the
barrel at local Y−88, cap at Y−90 and rod at Y−100/−140. The original source
pump is between those two configurations. This establishes source configurations,
not a manufacturer-certified stroke or pressure rating.

The factory uses two actual native actors, four colliders and one prismatic
constraint. The base/barrel/cap form one fixed factory case, certified by that
source composition. Their separate original owner identities remain intact.
The rod has a source triangle-mesh eye/head, an R4 convex shaft and a separate
source triangle-mesh gasket-attachment stub. Strict participation at Y10 and
Y56 keeps broad coplanar eye faces out of the shaft and avoids replacing the
stepped gasket profile with a convex loft. Pin holes remain source surfaces.

The retained simulation stops are eye separations 100.5..139.5 LDU, inside the
pinned source configurations. Native pressure volume uses the actual faceted R8
barrel area and the 40 LDU stroke reference. The source does not render the
hidden sealing piston or check valves: these are explicit ideal functional
assumptions. No sealing piston is added to rendering, inventory or export.
Simulation mass and inertia are declared approximations, not LEGO weight data.
Native rigid frames normalize the original rounded proper bases; serialized
source transforms and exports remain unchanged.

The native actor factory checks the existing 64-body/512-collider limits before
allocation, rejects duplicate source ownership, and validates native actor,
collider and joint lifetime before stepping. It never sets live positions or
velocities to produce a stroke. Disposal removes only its own actors/queue.

## Actual support envelope and ideal seal

The authored three-decimal axial basis gives a 0.04767256 LDU rod/base transverse
residual. The actual cap/rod residual is 0.00914981 LDU. These are source fit
errors, not free clearance. The complete native shaft support has a worst
actual cap-facet violation of 0.00897419 LDU. A narrowly declared ideal lubricated
cap fit permits at most 0.012 LDU; no generic joint tolerance changes.

Current and velocity/angular-velocity-predicted shaft support is clipped to the
actual finite cap and barrel slabs, including all support points and every
point-pair intersection at slab boundaries. This includes every actual hull
edge. The R8 barrel has zero additional radial allowance; its source shaft
radial margin at rest is 3.91324 LDU. The head, visible gasket attachment and
foreign colliders retain responding contacts. Tilt outside the complete
support envelope restores body/shaft contact. Only the exact admitted body and
shaft collider pair uses the ideal seal allowance.

`prepareSourcePneumaticPumpMount` separately binds the real `87083.dat` stopped
axle and two `32123a.dat` collars. The axle passes through the base's source X
round bore at world pivot [20,−60,70], axis [0,0,−1]. The two collar inside faces
capture the base at ±10 LDU. Keyed phase alone does not grant a zero-axial weld:
the witness explicitly distinguishes free pump rotation, two-collar axial
capture, keyed collar rotation and ideal axial grip. A copied witness or moved
collar refuses. This witness does not certify the axle's chassis support or
construct its native mounting constraint yet.

## Pressure and manual work

Manual input applies bounded equal/opposite force impulses to the actual body
and rod. Gas starts at atmosphere; chamber expansion admits accounted air and
compression supplies gas through ideal check valves. There is no charge-refresh
command. Manual effort defaults to 25 N. The separate native pressure-reaction
envelope defaults to 1,000 N, so a commanded 25 N push cannot silently clip
pressure resistance to 25 N and continue a full forced compression.

Source pump ports enable `requireUnclippedReaction` in the native kernel. If the
actual staged pressure reaction exceeds that envelope, the complete step refuses
before gas/accounting commits or any native body impulse. Existing engineering
callers preserve their default capped-force behavior. The source factory also
provides a cold pressure-envelope check.

A private controlled 1/240 run raised the outlet from atmosphere to 101,966.97 Pa,
with peak actual reaction 50.3138 N and zero clipped steps. Positive compression
manual work was approximately 0.0844 J. A regular 1/60 run remained within a
0.01..0.017 m compression-coordinate band, outlet 102,195.39 Pa and peak reaction
68.2157 N, with no clipped steps. With no modeled seal friction,
the bench retains bounded near-stop oscillation; these measurements do not establish
settled ordinary-session stability. The earlier private capped-25 N/full-stroke
million-pascal diagnostic is rejected as pressure-work evidence.

## Reproducible checks and remaining work

```sh
npx tsx scripts/audit-pneumatic-pump-source.ts
npx vitest run tests/unit/play-pneumatic-pump-native.test.ts tests/unit/pneumatic-circuit.test.ts --maxWorkers=1
npx tsc -b
```

The offline maintainer audit verifies six complete source closures and four
canonical surfaces; `--write` rebuilds only the generated binding manifest after
source review. No network or library-pack edits are needed.

Focused checks preserve the original source/export/inventory and verify native
pressure stall, intake/outlet accounting, atomic over-reaction refusal, equal
opposite mobile momentum, actual foreign obstruction/retry, source stop bounds,
complete predictive shaft contact restoration, no live pose/velocity setters,
duplicate/copy/source-change refusal and actual two-collar source capture.

Ordinary admission still needs the mounted native ownership graph, real source
valve/lever components with angle-driven routing, the pump/cylinder circuit
handoff and grounded/mobile collision acceptance. This bench still contains
moving triangle meshes. [Rapier recommends convex decomposition for dynamic
nonconvex bodies](https://rapier.rs/docs/user_guides/javascript/colliders/).
A complete mobile mechanism therefore needs source-positive convex covers or
separately certified source contact behavior; this bench cannot stand in for
that proof. Neither the complete Arocs nor all four cylinders are accepted by
these checks.
