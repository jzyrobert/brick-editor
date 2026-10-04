# Mechanical contact cost probe (4 October 2026)

Read-only investigation of the contact-agent implementation before integration.
Measurements are from Node 22.14 on the shared four-core ARM Neoverse-N1 VM.
Load fell from roughly 4 to 0.6–1.5 during the focused runs. They exclude drawing,
React, actor/world geometry, moving-platform handling and vehicle work. They are
not phone measurements or a frame-rate guarantee. Do not infer a speedup from a
single noisy sample or treat historical hulls as an equally accurate mechanism.

## Reproduce

After the contact implementation is integrated, from the repository root:

```sh
export PATH=/tmp/brick-node/node-v22.14.0-linux-arm64/bin:$PATH
FORCE_COLOR=0 npx tsx scripts/benchmark-play-contacts.ts --fixture=spur --mode=dynamic --rounds=2 --warmup=30 --ticks=150 --mass-kg=1 --baseline=237c339 > .local/spur-contact-cost.jsonl
FORCE_COLOR=0 npx tsx scripts/benchmark-play-contacts.ts --fixture=rack --mode=dynamic --rounds=2 --warmup=30 --ticks=150 --mass-kg=1 --baseline=237c339 > .local/rack-contact-cost.jsonl
FORCE_COLOR=0 npx tsx scripts/benchmark-play-contacts.ts --fixture=spur --mode=kinematic --rounds=2 --warmup=1 --ticks=60 > .local/spur-kinematic-cost.jsonl
```

Create `.local` before redirecting output if it is absent. The script writes a
private copy of the historical adapter there when `--baseline` is supplied. It
reads pinned library sources from disk, uses identical current fixture geometry
for both adapters, sets every moving body to 1 kg, alternates the dynamic order,
reports constructor entry time and tick distributions, and frees owned worlds.
JSONL includes source hashes, hardware/load, collider and mirror counts, measured
masses, motor states and coordinates. Run a fresh process to repeat cold entry;
subsequent entries in one process can reuse decomposition caches. The historical
adapter's helpers come from the current tree, so this is a hull implementation
comparison, not reconstruction of a complete old release.

These commands use `237c339`, a hull checkpoint retained in this branch's
history. The experimental tables below used the agent checkpoint `fbeb02f`;
record the chosen baseline and new hashes with each repeat. A short current/
historical smoke run verifies that the retained baseline loads and reports equal
prescribed masses; it does not supply new performance evidence.

`--disable-ccd=true` sets `maxCcdSubsteps=0` solely for a diagnostic run. It can
permit tunneling and is not a proposed production optimization. Body-level
`enableCcd(false)` alone does not disable automatic fixed-geometry CCD in the
pinned engine.

## Measured slices

The spur arrangement has 13 placements, five groups, ten moving members and
11,452 source triangles. The rack has eight placements and three groups. Each
trial drives its authored input at 90°/s in zero gravity. Two alternating trials
collect 150 ticks after 30 warm-up ticks. Equal mass still leaves different
geometry-dependent inertia, contact policy and historical controller behavior.

| Dynamic slice                                    | Native / mirrored colliders | Mean ms/tick, two trials    | p95 ms/tick, two trials     | Constructor entry, cold / warm |
| ------------------------------------------------ | --------------------------- | --------------------------- | --------------------------- | ------------------------------ |
| Spur, separate surface colliders before grouping | 1,959 / 1,959               | 25.99 / 25.67 (third 25.98) | 27.72 / 27.42 (third 27.44) | 686 / 384 ms                   |
| Spur, policy-class compounds, equal 1 kg bodies  | 18 / 18                     | 5.99 / 5.61                 | 6.97 / 6.40                 | 624 / 351 ms                   |
| Spur, historical hull adapter, equal 1 kg bodies | 11 / 11                     | 0.237 / 0.153               | 0.327 / 0.193               | 39 / 36 ms                     |
| Rack, policy-class compounds, equal 1 kg bodies  | 9 / 9                       | 67.07 / 67.65               | 76.07 / 76.39               | 609 / 265 ms                   |
| Rack, historical hull adapter, equal 1 kg bodies | 6 / 6                       | 0.254 / 0.161               | 0.435 / 0.200               | 50 / 38 ms                     |

The initial separate-collider spur runs used default density and 600 sampled
ticks per trial. Grouped and hull rows prescribe equal mass. At default density,
the source skins gave spur input/output masses 20.87/21.22 kg while hulls gave
32.67/91.75 kg. Mass assignment therefore matters; these are simulation proxy
values, not measured hardware weights.

The grouped spur reaches approximately 256.53° and −85.51° after 180 ticks,
with pin/arm coordinates near zero. The measured rack remains obstructed near
−0.72° / 0.18 LDU. The measured fixture mount interpenetrates, and this obstructed diagnostic must
be repeated after the corrected fixture is installed. Its cost is **not evidence
of working rack motion or accepted rack performance**. Native
world stepping accounts for almost all dynamic time. Grouping preserves roughly
1,956 spur children, including 1,479 children on the 24-tooth gear and 308 on the
8-tooth gear; it changes handles and broad-phase organization, not source skins.

A separate default-mass grouped spur CCD diagnostic, two 150-sample trials,
measured 5.66–6.05 ms/tick with CCD and 1.47–1.71 ms with CCD fully disabled.
Contact hooks ran 5,819 times across 180 ticks with CCD, 4,860 rejected, versus
3,307 calls / 2,706 rejects without CCD. Remaining native child sweeps have a
material cost even after reducing JS hook calls. External collision safety still
requires CCD or another verified sweep strategy.

The equal-mass runs recorded unchanged source hashes before/after each process:
`dynamics.ts` `96dbac3ff7230bc764976ed6129408807f3932b49d7d7bdd87360a3ffbe75dd2`,
`mechanical-solids.ts` `051c1681329bc652c80c310640bb88b13bab081f461be1c5f1e8884623e0fcd6`,
`surface-compound.ts` `db4d534c493e35a55563395d159030da3f5000fe46113e14d00ea03f0886aad8`.
These identify the experimental slice; later fixes can change both cost and
behavior, so retain the driver's new hashes beside any repeat result.

## Kinematic query costs

Private instrumentation preserved the collision algorithm while counting its
candidate visits. Before grouping, one 1.5° motor tick used six sweep samples and
visited 17,848,500 solid pairs, 327,015 stationary-filter entries and about
16.7 million policy calls. Six measured ticks took 5.57–5.93 seconds each and
made **zero shape queries** after exclusions. A limit on shape calls did not
bound the enumeration work.

Grouping reduced a tick to 750 pair visits, 1,430 stationary-filter visits,
880 policy evaluations and 20 shape queries. Yet two 30-tick trials averaged
277/271 ms, p95 291/275 ms. Pinned `Shape.contactShape` builds both raw native
shapes and frees them on every call, repeatedly reconstructing a large compound
and triangle-mesh acceleration structure.

A private diagnostic cached the same query shapes as persistent colliders in an
owned, unsimulated query world and called public `Collider.contactCollider` after
setting both poses. It allocated two query colliders for this fixture and freed
the query world on disposal. Two runs of 59 warm ticks averaged 6.00/5.21 ms,
p95 9.94/6.11 ms; first ticks cost 46/22 ms. Both accepted 90° / −30° after
60 ticks through the same six samples and contact checks. This is a verified
optimization candidate, not a claim that the production implementation already
contains it. Foreign colliders must be shadowed into the same query world;
handles from different collider sets cannot be mixed.

## Budget advice

Counts must be global over every active rig and include mirror/query resources.
The investigated 4,096-child per-rig limit alone permits 14 rigs to allocate
57,344 children, before mirrored resources, under the existing 64-body /
512-member caps. This is not a useful phone or larger-build performance bound.

- Keep a hard aggregate child cap, initially at most 4,096, enforced during shared
  preparation before constructing native worlds. Reuse prepared data rather than
  repeating decomposition for preflight and entry. This is a safety ceiling,
  not evidence that its maximum fits a frame budget.
- Bound policy classes/native handles separately (an initial 256 global ceiling
  is a defensible conservative guard), and count mirrored and cached query
  handles. Group only identical member, mating-ID set, feature and guide policy;
  merging different policy classes would broaden intentional exclusions.
- Bound per-member children, input triangles, hull points and total preparation
  work before compaction/signature construction or native allocation. A single
  1,479-child gear consuming most of a phone budget motivates cheaper reviewed
  volumetric proxies. Reducing a cap alone would refuse the current common gear.
- Count candidate enumeration as well as native queries across a complete motor
  tick, including every sweep segment and motor. Group/class exclusions and
  spatial pruning must occur before child Cartesian loops. A bounded work
  refusal must distinguish an exhausted check from a physical obstruction.
- Persist native query shapes; prune AABBs before creating any foreign shadow.
  Bound shadow collider/triangle counts and dispose all owned resources.
- Start phone stress verification with one active mechanism and a lower child
  allowance (for example 2,048), then measure actual devices. The current spur
  consumes almost that allowance, and the unresolved rack exceeds it. No phone
  support threshold should be declared from these VM numbers.

Larger mechanisms need cheaper source-reviewed volumetric/compound shapes and
measured aggregate costs. The current rack requires both physical and performance
repair before inclusion in a supported Dynamic path.
