# Architecture decisions

## ADR 001 — Authoritative document and occurrence identity

The domain core imports neither React nor three.js. A versioned project owns definitions, reference nodes, source records, layer assignments, groups, plans, bookmarks, mapping overrides and reserved rig/assets metadata. `Editor.project` returns a clone, so callers cannot bypass commands by mutating a returned object. Schema validators are generated at build time; imported projects cannot provide executable validators.

An occurrence ID is `JSON.stringify(nodeIdPath)`. Node IDs are unique **within their definition**, not globally. Copy-on-write copies definitions and local node IDs while changing the parent definition reference. Consequently the affected occurrence paths remain exactly the same, and layer memberships, groups, plans and overrides do not need identity remapping. Undo restores sharing. This is an intentional simplification of the spec's remapping sketch, with dedicated repeated-instance tests.

A command clones/stages the document, validates the complete result and commits once. Bounded structural patches store semantic JSON differences, not mesh objects or full render snapshots. Array changes currently replace their semantic arrays. History is capped at 100 entries and approximately 8 MiB of JSON text; oldest history is visibly flagged when discarded. A 500-entry session-only deduplication ledger rejects command ID reuse with changed content. Revisions advance monotonically through undo/redo. Replacement/import resets history after atomic staging; **undoing project replacement is not yet implemented**. The template UI exports the previous nonempty project first.

## ADR 002 — Starter subset, rendering and namespaces

Use six physical starter parts and their official dependency closure. A project-local `3001.dat` cannot inherit official purchasing identity. Geometry library and curated marketplace mapping pack are independently hashed and locked. Actual source headers and notices are retained. No connector pack is distributed; snapping/collision compatibility remains unverified.

The reference renderer owns one group per occurrence and shares compiled prototypes across occurrences with the same part/body colour. Source geometry and editable transforms never come from merged scene meshes. Prototype compilation uses an in-memory MPD and an explicit file map. This is necessary because the pinned loader rewrites `s/` references unless a mapping is supplied. The adapter rejects missing dependency attempts and empty official prototypes: the stock loader can otherwise swallow a subobject failure and return an empty group.

The colour configuration is read and hash-checked once, then its material directives are compiled inside each isolated loader scope. Passing material objects between loader instances is unsafe because edge and conditional-line caches belong to their originating loader. In-memory colour directives also allow uncached colour variants after the network goes offline.

Each prototype currently recompiles geometry for a distinct body colour; immutable geometry sharing **across colour variants**, change-set-only traversal remain optimisation work. Opaque non-reflected/non-sheared meshes now instance, and ordinary/conditional lines merge with fully transformed control attributes. Reference handles remain authoritative for picking and collision; transparent/reflected/sheared meshes use the reference path. Cache retention is bounded, resources are disposed at teardown, and the renderer refuses workloads above its explicit 5,000-occurrence / 128-variant / 50 MiB multiplied custom-source budget instead of dropping authored parts. Domain validation/export has a separate 100,000-occurrence limit. These are declared development budgets, not a performance claim.

Render space is a single π rotation about X. Occurrence transforms use full affine matrices. The renderer delegates internal custom-part compilation to pinned three.js; internal sheared references and broader BFC/material coverage are not yet certified. Ordinary lines and conditional lines use the loader's dedicated paths, not wireframe polygon edges. Diagnostic pink wireframe boxes represent unresolved references only. Catalogue thumbnails are original schematic SVGs; they are not replacements for model geometry.

## ADR 003 — Source preservation and native packaging

LDraw records retain raw text, ordering and node anchors. Unchanged reference records retain original tokens; edited transforms use JavaScript double-precision serialization and normalize negative zero. Source custom geometry retains records and exports transformed coordinates. Unknown records remain in place. Root imported step boundaries are mapped into a native instruction plan; nested subassembly instruction expansion and ROTSTEP camera semantics are deferred.

Native ZIP stores `project.json`, `sources/project.mpd`, hash-named asset string files, a per-entry checksum manifest and notices. The project object remains authoritative; duplicated source and asset entries must agree on import. Legacy version-one bundles remain readable. Asset storage is not a claim that every image format or texture projection renders. Unknown project versions, graph cycles, non-finite transforms, unsafe paths and duplicate model names fail validation. Archive decompression is incremental and bounded. Lower physical-device budgets and full geometry/texture decoded-memory accounting remain future work.

Default MPD includes all authored occurrences and all retained embedded definitions. Filtered/scoped MPD flattens leaf placements in world coordinates; custom stateful metadata triggers an acknowledgement requirement. This implementation does not certify preservation of third-party metadata semantics after structural edits.

## ADR 004 — Offline inventory

The pack is an original small table of factual part/colour correspondences, not a copied bulk catalogue. Public source pages and verification date are recorded per pack. The six part identities and red/blue/yellow/white/black combinations were reviewed; stock is not queried. Other mapped colour combinations are explicitly unknown until acknowledged. No inferred suffix stripping, nearest-RGB matching or marketplace login occurs.

Inventory walks semantic leaf occurrences and stops at physical part boundaries. User submodels expand, while primitive geometry inside a catalogue part does not become extra lots. Preview tokens bind the entire project hash, source scope, visibility, overrides, pack hash and options. This is deliberately stricter than revision-only validation. Locked layers remain readable. Unresolved/nonphysical/non-orderable occurrences block complete output; partial results carry XML plus a separate report. Authored-figure exclusion uses explicit `metadata.authoredFigureIds`, not filename heuristics.

Generic composite decomposition packs, ambiguous candidate resolution, purchased-stock allocation and all optional Wanted List pricing/preferences are not implemented. Such imports remain unresolved and cannot silently enter complete XML. Destination validation requires a separate human-authorized BrickLink session and has not been attempted.

## ADR 005 — Persistence, automation and deployment

LocalStorage saves a checked new envelope, then advances the head, retaining recoverable snapshots. Same-origin Web Locks serialize writers when supported, and stored revision comparisons refuse conflicts. Without Web Locks, an exclusive IndexedDB readwrite transaction serializes checksum/read/publish operations; project bytes remain in LocalStorage. A timeout guard prevents late publication after lock expiry. If neither coordination mechanism is available, writes fail with a backup/retry UI. Storage events notify other tabs without replacing their drafts; users can fork or back up before reloading the saved revision. No automatic project-data migration to IndexedDB occurs. Serial autosave uses a 750 ms debounce and three-second scheduling target; completion latency still depends on storage and browser scheduling.

Browser automation is opt-in (`?automation=1`) and shares the command/inventory services with the UI and CLI. Workers handle LDraw parsing and rectangular fills; jobs expose running/success/failure/cancellation. Native decompression remains on the main thread with bounded streaming. Image capture uses a fixed revision and offscreen target, restores renderer state in `finally`, validates dimensions and returns a manifest. GPU pixels are not promised identical across platforms. Fast/Balanced/Photo apply distinct edge, shadow, tone and pixel-ratio policies; bounded overrides are independent. Capture restores interactive settings and includes the actual light rig, quality controls, clipping planes and device limits in its manifest.

The production bundle is static and works under a Vite base path. No third-party runtime fonts, scripts, model uploads, secrets or rendering service are required. The CLI's temporary localhost server is a local development/testing adapter.

## ADR 006 — Milestone order and scope boundary

The user explicitly reprioritized Play while continuing the remaining roadmap and requested parallel agents plus an independent mobile UX loop. This supersedes the previous implementation order without declaring unfinished P0 gates passed. Rapier 0.21.0 is now lazy-loaded for a kinematic capsule over actual triangle surfaces. First-person exploration has no body; the original procedural third-person figure uses only declared rigid joints. Play state never implicitly edits the project. Authored hinges and planar kinematic vehicles are a separate rig session; applying a pose is revision-checked and undoable. Dynamic suspension, advanced assembly planning, path tracing and collaboration are not claimed implemented. PDF publishing uses lazy-loaded pdf-lib with sequential bounded captures.

The scaffold's vulnerable dependency versions were replaced with exact patched pins and a regenerated lockfile. See the dependency audit and final verification report. The three.js r174 loader is deliberately pinned behind its adapter; the matching type package has a parse signature mismatch, isolated with one documented structural cast at the adapter boundary.

## ADR 007 — Explicit offline snapshots and links

Offline installation is a user action, caching one versioned app, lazy feature chunks and pinned starter library. Update activation is explicit and prior snapshots are retained. Cached static responses ignore `Vary` after same-origin scope checking, since module requests can carry different Origin headers from precache requests. No authenticated/remote resources are cached. This policy is verified by a full offline reload and feature loading, not just a disconnected current tab.

Share links contain bounded compressed MPD, a library lock and checksum. They exclude local history and native-only editor metadata. Imported links preview as temporary projects before an explicit open; nonempty current builds are backed up first. A checksum detects accidental corruption, not authorship.

Play moving collision derives separate triangle meshes for authored rigid groups, leaving the static snapshot free of duplicate rest-pose surfaces. Both rendering and collision use the same fixed-tick kinematic pose. Swept surface displacement bounds conservatively block motion near the walking capsule; no riding, pushing or vehicle/world response is implied. Instruction metadata is an optional parallel array validated to match step count, with reorder/split/merge/filter operations updating both arrays atomically.

On WebGL loss, capture waits and owned shader-completion polling abort. The pinned Three renderer restores its internal GPU caches from retained scene resources; the adapter resets render target/viewport and invalidates the view. Shader polling uses the pinned renderer material/program properties and is bounded to 30 seconds. Regression coverage must be rerun when upgrading Three.

Editor mode lifecycle effects are separate from instruction-plan preview effects. Document replacement cancels an old Play session synchronously; delayed React plan rendering must not cancel a new API session entered immediately after an import. A cached import/edit/undo/Play regression covers that ordering.
