# Remaining work

Open work only. What is implemented, with its evidence, is in [docs/STATUS.md](docs/STATUS.md) and [docs/VERIFICATION.md](docs/VERIFICATION.md), measured against [spec.md](spec.md). The build is a working development build, not a complete P0 release. When you close an item, delete it here and record it in STATUS (and `src/automation/capabilities.json` where a capability changes); when you find one, add it under the right heading.

## Measure on real hardware

The CI and development VM measure SwiftShader triangles, draws, heap and CPU time, not phone GPU time or memory ceilings.

- [ ] The raised limits (150,000 parts, 24 M scene triangles) on a physical phone, including adaptive culling cells and culled variants on phone GPUs ([PERFORMANCE-MINEBENCH](docs/PERFORMANCE-MINEBENCH.md#at-the-raised-limits)).
- [ ] Cream Gallery/Play shell on physical phones, including horizontal response browsing and the compact toolbar during placement.

- [ ] Loading skeleton: warm city loads were 1–7 s slower with it in all four pairs on a loaded VM; compare against `?skeleton=0` on a quiet machine ([PERFORMANCE-MINEBENCH §6](docs/PERFORMANCE-MINEBENCH.md#6-loading-skeleton)).
- [ ] Photo time to a clean still and first-still shader compile on a real phone.
- [ ] Backdrop frame times on a real phone.
- [ ] The spec's performance gates: repeated 5,000-part trials on reference hardware (only single software runs are recorded).

## Gallery content

- [ ] Publish more prompts and agents (10 temple builds from 2 models are published); see [GALLERY](docs/GALLERY.md).

## Rendering and performance

- [ ] Low-resolution (`8/`) stud primitives as a phone geometry option, or distance LOD: exposed studs are now most of what plain builds draw (needs its own quality setting and cache key).
- [ ] A phone pixel-ratio cap of 1.5, as Minebench uses.
- [ ] Incremental occlusion on edits (a full pass is ≈ 0.4–1 s at 150,000 parts).
- [ ] Explode and other moving-part views keep only part-local cavity culling; budget them like the step views.
- [ ] Compact binary placement format for autosave and recovery of flat models (≈ 17 bytes per part instead of ≈ 247 bytes of project JSON).
- [ ] Remaining main-thread tasks at 20,000 parts (0.1–0.35 s each): occurrence derivation, the renderer's occurrence walk, structured-clone transfer to and from workers, complete-library registration, batch classification and fill. Custom parts and raw primitives still compile on the main thread and are not cached.
- [ ] Box/lasso: exact triangle refinement for Through at the region's edge; a lower-resolution ID pass for very large models on slow GPUs.
- [ ] Route Standard captures through tone mapping (they are not tone-mapped today); logo-on-stud primitives once the library has them.
- [ ] Photo: textured faces, glitter/speckle flakes, auto exposure, joint-bilateral upsampling of the traced still; revisit three-gpu-pathtracer's WebGPU tracer (needs three ≥ r185).
- [ ] Contact shadow for Realistic: prototyped and dropped ([RENDERING](docs/RENDERING.md#one-studio-for-realistic-and-photo)); revisit only if it can avoid a full extra pass per edit on phones.

## Resources and reliability

- [ ] Output pagination and device-aware instruction derivation; make share links, pagination and derivation follow the device's resource profile.
- [ ] Include source model author/licence credits inside exported instruction booklets; current agent workspaces retain `source.json` and native source notices for adjacent attribution.
- [x] Provide an agent MPD workbench and concise prompt with source aliases, nested replay audits and actual selected diagram review ([three-round pilot](docs/reports/instruction-generation/agent-workflow.md)).
- [x] Pin a fresh deterministic draft for constrained agent refinement, retain hard source/workbench prerequisites and compare four paired cases with a critic ([hybrid trial](docs/reports/instruction-generation/hybrid-workflow.md)); local gains leave overall3/3/3/2 scores unchanged.
- [x] Run heuristic draft generation in a cancellable worker, reject stale results and retain undo/redo and prior plans ([v9 evidence](docs/reports/instruction-generation/wheel-operations.md)).
- [ ] Nested vehicle/figure/bird workbench programmes, explicit scene placement and receiving-interface/handling tasks; bounded publication chapters for London/Hut. The continuing critic's whole-corpus acceptance remains open.
- [ ] Budget the JS heap (≈ 1.1–1.5 KB per part; today bounded only by the occurrence limit).
- [ ] Bound remaining compiler work across valid project graphs (occurrence guards alone do not prove it).
- [ ] M0 conformance: whole-library BFC coverage, broader conditional-line image comparisons, custom material scope, source assets and compiler budgets.
- [ ] M3 reliability: fully portable library packs, native migrations, broader storage-recovery coverage, graphics recovery across more drivers.

## Editing and connectors

- [ ] Connector families: clips and bars, brick hinges and hinge plates, Technic pins and axles, side anti-studs (brackets). LDCad shadow data only after its own licence review. Older doors without pins (3644, 3861c) are not hinge-seated.
- [ ] Snap together: check paste, duplicate, arrays and fill; warn when a move leaves parts floating; live tint while dragging handles; upper-floor ground levels.
- [ ] M2: general structural regrouping.
- [ ] Fill: global packing optimisation and connector-aware fill.
- [ ] Architectural aids: room outlines and areas, dimension-string overlays.

## Library, catalogue and inventory

- [ ] Textures: gloss maps, embedded `!DATA` images, texture mapping over part references in ordinary models; include texture-mapped subfile references in the complete pack's closures at the next release.
- [ ] A first real `npm run library:update` when LDraw publishes a new `complete.zip`.
- [ ] Catalogue-verified (BrickLink page) mappings beyond the curated catalogue: a person checks each page (`npm run library:review-mappings` lists the most common).
- [ ] Two catalogue parts stay unmapped (3245c, 3049b: mould equivalence not established); a bulk "accept all checked matches"; per-occurrence decisions for mirrored copies outside the technical-details form.
- [ ] Colour availability for prints whose files name no Rebrickable number; verified colour lists beyond the curated catalogue.
- [ ] Rebrickable colour ids: only 154 of 322 LDraw colours have exactly one checked id (`scripts/color-joins.json`); parts in other colours are left out of the Rebrickable CSV.
- [ ] Sharper complete-library thumbnails on high-DPI phones (cells are 80 px to keep the pack near 25 MB).
- [ ] Official sets: alternate models (about 200 sets have B-models whose file names appear only on set pages, which are not indexed).

## Play

- [ ] Riding dynamic or kinematic platforms and seated driving of dynamic vehicles; clutch strength and breaking assemblies.
- [ ] Sliding, roller and lift doors (garage and roller doors in official sets are excluded today).
- [ ] Compound-rig and arbitrary-frame authoring UI; auto-rig proposals beyond door leaves; advanced assembly planning.
- [ ] Trains: coupling and uncoupling, walking about on a moving train, sloped track and ramps, crossings, flexible track, 4.5V/12V points, turntables, signals and level crossings that react, wheel spin and connecting rods, trains colliding with the rest of the build.
- [ ] Movement and camera: corner assist round door jambs; a line-of-sight camera for tight interiors.
- [ ] Figure: a choice of figures (heads, torso prints, hats) from the complete library; bent-knee seating for low cabins.
- [ ] Backdrops: night lighting for Night city, optional 3D scenery (trees, lamp posts) with collision, more street-map tiles.
- [ ] Broader M4 exploration acceptance on real devices.

## Instructions

- [x] Measure pictorial PDF blocks and preserve complete action/part/marker text at accepted picture/font sizes; selected official books shrink329→249pages, with full content/pixel audits ([evidence](docs/reports/instruction-generation/print-layout.md)). Chapter publication and assembly guidance remain open.

- [ ] Advanced editing of authored plans: callouts, arrows, exploded offsets and assembly drafts in published instructions.

- [x] Complete two additional deterministic instruction/critic rounds: estimated preclosure ordering, typed receivers, narrow axle/bush operations and legible axis details. Nine supported samples are editable 3/5 drafts; complex mechanisms still need operation editing ([rounds 5–6](docs/reports/instruction-generation/refinement-rounds.md)).
- [x] Complete four deterministic instruction refinement/review rounds for hobbyists: pictorial/context diagrams, prior-state batching, flexible drawing ownership, conservative workbench/join actions and destination views. See [refinement evidence](docs/reports/instruction-generation/refinement-rounds.md).
- [x] Bounded continuous straight CAD insertion checks with local stud contact allowances, blocker precedence, actual workbench/join replay, explicit unknowns and stale-check invalidation (physical feasibility remains unverified).
- [ ] Instruction follow-ups: physical builder testing, broader insertion/rotation and contact-fit checks beyond the bounded straight CAD checker, verified detached stability/handling and flexible identity metadata, richer Technic/jaw/axle operations and physical flips; broader bounded search needs executable validated actions first.
- [x] Repair concealed completed-wheel views and live notes that depended on exported R/P labels; source-reviewed outward cameras, named receivers, actual bare views and all 30 resolved-join re-review ([evidence](docs/reports/instruction-generation/wheel-presentation.md)).
- [x] Narrow source-owned figure procedures with conditional supplied assemblies, receiver-before ordering, eligible separate benches and labelled prior-member wrist details ([evidence](docs/reports/instruction-generation/figure-procedures.md)); fit/access remain unknown.
- [x] Separate bounded static source workbenches, finite panel/seam decoration ordering, completed-candidate viewer control and deferred scene placement ([v14 evidence](docs/reports/instruction-generation/static-workbenches.md)); physical support and fit remain unknown.
- [x] Stage collared Crane pins on a held five-part joint workbench and show an isolated completed hinge detail alongside real context/bare receiver; preserve actual mounting crossings and source poses ([v15 evidence](docs/reports/instruction-generation/mechanism-procedures.md)).
- [x] Add bounded source hierarchy/STEP scheduling for the Shark head and jaw, finite paired clip/handle details, exact custom-part closure and measured four-view PDF rows ([v16 evidence](docs/reports/instruction-generation/source-guided-articulation.md)); whole Shark improves1→2/5 in desk review.
- [ ] Further automatic instruction transfers: executable Crane mounting/handling, remaining Shark body/tail finite receivers and constructive jaw foundations, wheel/rail readiness, additional articulated hinges and vehicle accessory clips, compact supplied-figure alternatives and bounded publication chapters. Deduplicate mechanism uncertainty notes and sparse marker-legend continuations. V15 preserves final-source control-stick CAD intersections; whole Crane2/5, Shark2/5 and Train3/5 leave broader critic acceptance open ([latest review](docs/reports/instruction-generation/source-guided-articulation-critic.md)).

## Build scripts

From [AGENT-BUILDING](docs/AGENT-BUILDING.md) and the [design-language study](docs/DESIGN-LANGUAGE.md):

- [ ] 33° and curved roofs; round towers from curved parts; footprint-aware `scatter`; mirrored components.
- [ ] `apply` into an open project (merge as a submodel).
- [ ] A `band`/`cornice` op (a string course round a room, inverted slopes under a protruding cornice); `sill`/`lintel` on openings; `piers` between openings.
- [ ] A SNOT detail op (headlight bricks and brackets holding tiles, panels and signs flat on a facade); crenellations for castle walls.
- [ ] Packer: a maximum brick length for plain walls (official 1-wide bricks average 3 studs, ours 5); bonding across the two rows of 2-stud walls; weighted colour mixes.
- [ ] Instruction steps per course or storey in compiled builds; facade metrics in the compile report (colour and depth changes per stud, brick lengths).
- [ ] Also asked for in the [third run's interviews](docs/samples/japanese-temple-one-shot-geometry/README.md#what-the-models-said-about-efficiency) and not done: repairs as patches against stable op IDs, and tested recipes (pagoda tier, hall, lantern) with measured costs. Repairs stay MineBench-style for now.
- [ ] Still open from the [Opus 5.5 interviews](docs/samples/japanese-temple-one-shot-claude-target/README.md#what-the-models-said): parts search and checks as real tool calls rather than replies (Codex offers custom tools only through its code mode); overlap ranges in one convention (today "z 5–5" is a rounded box edge); every pair behind "(7 pairs like this)".
- [ ] Part heights from bounds overshoot on curved parts: 15068, 11477 and 88930 are listed (and reserved) as 3 plates but are 2, 93273 as 4 (about 2), 24201 and 92950 as 4 (3). `partPlates` in `src/build-script/part-list.ts`; changing it changes what the compiler reserves.
- [ ] 2435 Pine Tree Small: its 3 × 3 footprint cannot be centred on its origin, so its reach reads "1 stud at −x, −z" and nothing at +x, +z.

## Agent gallery

From [GALLERY-PLAN](docs/GALLERY-PLAN.md); the backend of phase 1 (publish script, D1 schema, index format and download checks in `src/catalog/gallery-index.ts`) is built:

- [x] Phase 0, D1: `brick-gallery` and `brick-gallery-preview` created with the migration applied; IDs in `wrangler.gallery.toml`.
- [x] Front end: Gallery reads the published index, the detail page spins builds in 3D, and the CSP allows the bucket origin.
- [x] Phase 0, R2: buckets `brick-gallery` and `brick-gallery-preview` created.
- [x] Phase 0, the rest: custom domain, CORS, cache rule (browser TTL respects origin) and publishing token; 10 builds from the two run-4 temple runs published.
- [ ] Check the live 3D preview's memory and frame time on a physical phone beside the workspace scene.
- [ ] Publish the 24 temple builds with `--remote`; check them on a 1,080 × 1,800 phone, and that a second visit to a build fetches only `index.json`.
- [ ] Phase 2: the vote Function, the arena and the AGENTS.md rule change. Needs 2 or more prompts with 3 or more agents each.
- [ ] Phase 3: `scripts/gallery-rank.ts`, the hourly workflow, a leaderboard view in Gallery.

## UI and docs

- [ ] Migrate legacy panel-content styles (slate tones, 11 px help text) to the [DESIGN.md](DESIGN.md) scale.
