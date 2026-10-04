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
FORCE_COLOR=0 npx tsx scripts/benchmark-play-contacts.ts --fixture=spur --mode=kinematic --ground=true --rounds=2 --warmup=30 --ticks=150 --mass-kg=1 > .local/spur-ground-cost.jsonl
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

## Integrated spur with ground (4 October 2026)

The integrated checkpoint at `a7297d8` was measured separately with the optional
kinematic ground plane enabled. The normal 90°/s drive accepts 270° / −90° after
180 ticks in both trials. The 150 measured ticks follow 30 warm-up ticks; source
hashes are identical at process entry and exit. Load is 0.72–0.82 on the same
four-core VM. Rendering, the actor and vehicle work are still excluded.

| Kinematic ground trial | Mean ms/tick | p95 ms/tick | Entry  | First tick |
| ---------------------- | ------------ | ----------- | ------ | ---------- |
| Cold                   | 7.04         | 7.82        | 606 ms | 53 ms      |
| Warm                   | 6.75         | 7.14        | 396 ms | 24 ms      |

This fixture has 15 moving policy classes, 1,956 convex children, 13 stationary
solids and six walking-world colliders including ground. Plane checks use a
conservative enclosing-box certificate when every intermediate point stays
clear; near planes retain exact boundary support and swept refinement. A faster
reverse tick now uses 252 counted checks instead of exhausting the 200,000-work
limit. The full 4,080-tick phase/reversal unit remains unchanged apart from its
deadline: an isolated trial takes 44 seconds, so its former 15-second allowance
was replaced with 90 seconds. This long mixed-rate replay is distinct from the
normal-rate sampling above.

The measured `mechanism.ts` hash is
`5189ab8921c6bce6f38e55cd7432f7f3170de16c364135e7cbfd8dce36119fa7`;
`mechanical-solids.ts` is
`0bdf7d6b1c526e524e79186402df5501f7474ca763d9043440d1417abf05f610`.
Later shape fixes require new measurements. These results neither accept the
unresolved rack contact path nor establish a phone frame budget.

## Integrated spur after oblique admission (4 October 2026)

After `1461efb`, a fresh process repeats both modes with ground enabled for the
kinematic slice and historical hull baseline `237c339` for the native slice:

```sh
FORCE_COLOR=0 npx tsx scripts/benchmark-play-contacts.ts --fixture=spur --mode=both --ground=true --rounds=2 --warmup=30 --ticks=150 --mass-kg=1 --baseline=237c339 > .local/final-spur-cost.jsonl
```

Start/end hashes match. The measured `mechanical-solids.ts` hash is
`1d5185542ad957472ab4a6d277e9b2db4d6e630089c217832ac49d82232effce`;
the mechanism hash remains the one recorded above. Load is 1.89–1.97 at process
entry/exit on the same VM. Each moving body is prescribed 1 kg; reported native
masses differ from that by at most 0.00000024 kg.

| Slice                                  | Mean ms/tick, two trials | p95 ms/tick, two trials | Entry, first / second |
| -------------------------------------- | ------------------------ | ----------------------- | --------------------- |
| Native source compounds                | 8.76 / 8.25              | 9.70 / 9.03             | 577 / 288 ms          |
| Historical hull adapter                | 0.274 / 0.169            | 0.374 / 0.209           | 38 / 34 ms            |
| Kinematic source compounds with ground | 7.00 / 6.73              | 7.74 / 7.08             | 384 / 329 ms          |

Native compounds retain 18 colliders and 18 walking mirrors but now have 1,924
children: avoiding unnecessary radial cuts preserves whole contained bearing
parts. Native input/output reach 256.66° / −85.553° in both trials; historical
hulls reach 247.59° / −82.529°. Kinematic coordinates reach 270° / −90° in both
trials. The different geometry, inertia, contact policy and controller version
still prevent an accuracy-equivalent comparison with coarse hulls. These samples
do not show a speedup over the earlier experimental compounds, and do not accept
the rack or a phone frame budget. Rendering, actor and vehicle work are excluded.

## Two drives in one live session (4 October 2026)

`scripts/benchmark-play-combined.ts` builds two canonical spur assemblies 400 LDU
apart, merges their stationary parts into one anchored frame, and retains both
independent motor/transmission paths. Run it from the repository root:

```sh
FORCE_COLOR=0 npx tsx scripts/benchmark-play-combined.ts > .local/combined-cost.jsonl
```

Unlike the isolated contact driver, this probe uses actual `PlaySession` entry
and fixed ticks, including ground, explorer and native gravity. It checks actual
motion, both 8:24 phase relations, unblocked state, source preservation and
disposal. It prints hardware/load and five source hashes and requires those
hashes to match at exit. Each moving group is prescribed 1 kg. The source hashes
match the integrated spur checkpoint above; VM load is 0.71–0.78.

| Two shared-frame drives | Entry    | Mean ms/tick | p95 ms/tick | World colliders |
| ----------------------- | -------- | ------------ | ----------- | --------------- |
| Kinematic               | 1,251 ms | 40.68        | 42.86       | 11              |
| Native                  | 776 ms   | 26.25        | 29.07       | 38              |

The 26-part, nine-group rig compiles in 1,023 ms. After 30 warm-up and 60 measured
ticks, both kinematic shafts reach 135° / −45°; native shafts reach about
123.21° / −41.07°. Undriven native arm joints fall under gravity. A third copy
(39 parts, 13 groups) is refused in both modes with the unchanged explicit
4,096-solid preparation limit; its source is also preserved.

These results establish bounded admission and motion, not performance
acceptance. Both two-drive physics costs exceed a 16.7 ms fixed-tick budget
before drawing; the aggregate proxy cap alone cannot establish useful mobile
capacity. This is one measured trial per mode, distinct from the two-trial
isolated spur measurements. It does not accept rack guides, moving housings,
arbitrary larger mechanisms or physical phone frame rate.

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
