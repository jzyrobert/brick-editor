# Remaining work

Open work only. What is implemented, with its evidence, is in [docs/STATUS.md](docs/STATUS.md) and [docs/VERIFICATION.md](docs/VERIFICATION.md), measured against [spec.md](spec.md). The build is a working development build, not a complete P0 release. When you close an item, delete it here and record it in STATUS (and `src/automation/capabilities.json` where a capability changes); when you find one, add it under the right heading.

## Measure on real hardware

The CI and development VM measure SwiftShader triangles, draws, heap and CPU time, not phone GPU time or memory ceilings.

- [ ] The raised limits (150,000 parts, 24 M scene triangles) on a physical phone, including adaptive culling cells and culled variants on phone GPUs ([PERFORMANCE-MINEBENCH](docs/PERFORMANCE-MINEBENCH.md#at-the-raised-limits)).
- [ ] Loading skeleton: warm city loads were 1–7 s slower with it in all four pairs on a loaded VM; compare against `?skeleton=0` on a quiet machine ([PERFORMANCE-MINEBENCH §6](docs/PERFORMANCE-MINEBENCH.md#6-loading-skeleton)).
- [ ] Photo time to a clean still and first-still shader compile on a real phone.
- [ ] Backdrop frame times on a real phone.
- [ ] The spec's performance gates: repeated 5,000-part trials on reference hardware (only single software runs are recorded).

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

- [ ] Output pagination, cancellable instruction derivation and a user-facing derive-again control; make share links, pagination and derivation follow the device's resource profile.
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

- [ ] Advanced editing of authored plans: callouts, arrows, exploded offsets and assembly drafts in published instructions.

## Build scripts

From [AGENT-BUILDING](docs/AGENT-BUILDING.md) and the [design-language study](docs/DESIGN-LANGUAGE.md):

- [ ] 33° and curved roofs; round towers from curved parts; footprint-aware `scatter`; mirrored components.
- [ ] `apply` into an open project (merge as a submodel).
- [ ] A `band`/`cornice` op (a string course round a room, inverted slopes under a protruding cornice); `sill`/`lintel` on openings; `piers` between openings.
- [ ] A SNOT detail op (headlight bricks and brackets holding tiles, panels and signs flat on a facade); crenellations for castle walls.
- [ ] Packer: a maximum brick length for plain walls (official 1-wide bricks average 3 studs, ours 5); bonding across the two rows of 2-stud walls; weighted colour mixes.
- [ ] Instruction steps per course or storey in compiled builds; facade metrics in the compile report (colour and depth changes per stud, brick lengths).

## UI and docs

- [ ] After the tabbed menu redesign lands, update menu paths in the docs (many still say "Project → …" or "Camera views → Look") and refresh screenshots.
- [ ] Migrate legacy panel-content styles (slate tones, 11 px help text) to the [DESIGN.md](DESIGN.md) scale.
