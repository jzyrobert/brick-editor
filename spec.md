# Brick Editor — implementation specification

**Version:** proposed 1.1  
**Research dates:** original review 26 September 2026; BrickLink and Minebench amendment 27 September 2026  
**Delivery model:** static, browser-based application; no application backend  
**Primary technologies:** TypeScript, React, Vite, three.js  
**Audience:** implementation team or coding agent

This is a proposed product and engineering specification, not a claim that the application or its performance has already been implemented or tested. Requirements, algorithms, limits and milestones below are design decisions unless explicitly identified as findings from a source. References `[S01]`–`[S46]` are listed at the end. Version 1.1 integrates the requested BrickLink XML base feature and a simpler exploration/character-animation design; it supersedes the corresponding version 1.0 requirements. No application implementation or authenticated BrickLink import test was performed as part of this specification revision.

### Changes in version 1.1

BrickLink-compatible **Wanted List XML is P0**, with offline generation, versioned part/colour mappings, a resolution preview, structured reports, layer/selection scope and agent/CLI support. It is no longer a future inventory feature. Basic first-/third-person exploration is separated from vehicle mechanisms: it is a P1 workstream after the core editor. First person requires no body or hands; third person uses a rigid-part joint hierarchy, not deformable limbs or full-body physics. Minebench is a reference and selective MIT-code-reuse candidate, not the application's data model or backend. Sections 2, 3, 4, 6, 7, 17, 19, 20, 22, 23 and 24 have been reconciled with these changes.

## 1. Executive decision

Build a local-first editor whose authoritative state is a renderer-independent document. Use three.js to render a derived view of that document, and use LDraw as the interchange format rather than the entire native project format. A single, versioned command API must serve mouse controls, touch controls, tests and headless agents.

The essential separation is:

```text
Human UI ───────────────┐
                       ├─> validated commands ─> document + history
Headless automation ───┘                          │
                                                 ├─> three.js scene
                                                 ├─> LDraw/native + BrickLink XML export
                                                 ├─> instruction plans
                                                 └─> disposable play-world snapshot
```

### 1.1 Research findings that affect implementation

**Real-time editing is feasible.** The three.js LDraw loader creates scene objects; the application can change their transforms, visibility and material bindings after loading. Its material-preloading API specifically describes editor-style, on-demand part loading. It is not a complete editor, source-preserving document parser, connectivity engine or exporter. Do not reload a complete LDraw model for every edit. [S08, S09]

**Do not copy the example's whole-model merge into the editable document.** The example offers a geometry-merging path and applies a coordinate conversion. Treat both as rendering implementation details, not a project data model. [S10]

**Licensing needs an explicit gate.** `buildinginstructions.js` declares public-domain/Unlicense status. In contrast, Web Lic's README expressly says that its source is not open source and cannot be used outside Lic. The public BrickStep pages describe an automatic-generation service, but the material reviewed did not establish a reusable implementation licence. Do not vendor either service's code on the assumption that visibility or free use grants redistribution rights. [S12–S14]

**Connectivity is additional data.** The LDCad shadow library supplies snapping/mirroring metadata absent from ordinary geometry, under CC BY-SA 4.0. Its data and adaptations need their own provenance and licence handling. The editor must still implement matching and validation. [S16, S17]

**Import compatibility and render compatibility are separate.** The reviewed three.js loader source does not implement `!TEXMAP`. Preserve texture-related records and assets independently; expose a fallback warning until a tested texture adapter is available. The reviewed source also identifies glitter/speckle material finishes as unimplemented; track these separately from base-colour support. Do not advertise full LDraw support merely because some models render. [S04, S05, S09]

**LocalStorage is a constrained first persistence adapter.** Web Storage is synchronous, and MDN documents a localStorage allowance of about 5 MiB per origin. Asset caches and large projects must not be designed around unlimited localStorage. [S23, S24]

**The reference LDraw.org viewer is not the desired privacy model.** Its page states that submitted models are uploaded for processing. This application must instead parse user files locally by default. [S15]

**BrickLink output is a dedicated interchange target.** Use the Wanted List tag profile in the user-specified help article, not the generic inventory example. A bill of materials needs its own aggregation and catalogue-resolution services; rendering geometry is not a purchase list. [S39]

**Minebench is useful selectively.** Its application code has an MIT licence; its bundled Faithful textures have separate terms. Review the explorer and collision source as references, but replace voxel geometry assumptions and remove hosted build-fetching dependencies. Detailed scope is in section 19.6. [S40–S45]

### 1.2 Naming, assets and legal controls

Use neutral product language: “bricks”, “parts”, “builds”, “brick character” and “construction instructions”. Treat avoidance of a manufacturer name as a branding decision, not as sufficient copyright clearance. Patent, trade mark, copyright and design protections are different rights. Expiry of an underlying construction patent is not blanket permission for every newer part, decorated surface, character, model or digital asset. Obtain appropriate legal review before public commercial launch. [S31]

The library header specification permits several licence declarations, including CC BY 4.0, dual CC BY versions and older declarations. The build pipeline must inspect actual distributed files rather than assigning one guessed licence to the entire collection. For example, the reviewed official part page S36 has its own concrete licence declaration. Retain notices, authorship and required attribution; do not remove required third-party notices to enforce neutral UI wording. Use original templates and an original/default character design. [S06, S07, S36]

## 2. Product scope and release boundaries

Use these priority labels:

| Priority | Meaning | Scope |
|---|---|---|
| P0 | Required for initial usable editor | Local files, real-time editing, responsive UI, layers, undo, grid placement, bulk tools, native save, LDraw export, **BrickLink Wanted List XML export**, image capture and automation |
| P1 | Interoperability, publishing and basic exploration | Wider connector support, texture rendering, instruction editing/generation, small share links, offline packs, refined rendering and **first-/third-person exploration with simple joint animation** |
| P2 | Mechanisms release | Authored moving assemblies, kinematic vehicles and optional dynamic physics; not a prerequisite for basic exploration |
| P3 | Optional expansion | Advanced assembly planning, path tracing, inventory-constrained generation, collaboration through an explicitly separate service |

P0 includes simple imported-step playback and layer-based step generation; polished instruction-book layout is P1. BrickLink XML must work for the audited starter palette without any marketplace login, API key or runtime catalogue service. Imported parts outside verified mapping coverage remain editable and receive actionable export diagnostics. Broader mapping coverage is incremental, but the exporter itself must not be deferred. Basic exploration is P1; the user has not made it a P0 release blocker. P0 can render/import a broader part library than it can certify for snapping. Unverified parts remain usable in grid/free-placement modes and must be labelled accordingly.

The product has five top-level modes: **Build**, **Instructions**, **Photo**, **Play**, and **Project**. Unimplemented modes must not pretend to work: hide them or show an honest feature-state panel during development.

The initial release excludes accounts, server storage, automatic model uploads, multiplayer, a hosted rendering API, universal physical-build validation and automatic rig inference for every imported model. Architecture must not prevent those additions, but they must not be prerequisites for a static deployment.

## 3. Technical architecture

### 3.1 Chosen stack

Use React and TypeScript for the interface, Vite for bundling, and a directly managed three.js renderer. Do not model every render mesh as React component state. Keep domain logic independent of React and three.js. A small UI store may hold selection, panels and tool state; it must not become the only representation of the build.

Use a WebGL2 renderer for the initial implementation. Current three.js WebGLRenderer requires WebGL2; do not promise a WebGL1 fallback. WebGPU may be a later adapter after material, picking and export tests pass. [S26]

Recommended supporting components are `three-mesh-bvh` for measured spatial-query bottlenecks, `fflate` for bounded compression/ZIP operations, `pdf-lib` for client-generated instruction PDFs, and Playwright for browser automation and acceptance tests. Rapier is the proposed optional physics engine. Verify and pin every package and its transitive licences in the delivered lockfile. [S18–S22, S27, S29, S30]

Use JSON Schema contracts with validators precompiled at build time, for example with Ajv's standalone-code facility. Only the application's trusted schemas are compiled; imported projects must never supply executable validators. [S34]

### 3.2 Module layout

```text
src/
  core/           document, identity, transforms, commands, history, validation
  ldraw/          source AST, virtual filesystem, import, export, loader adapter
  catalog/        index, search, thumbnails, library locks, provenance
  inventory/      BOM traversal, catalogue mappings, validation, BrickLink XML
  edit/           tools, selection, workplanes, snapping, fills, constraints
  render/         scene adapter, materials, edges, picking, capture, quality
  persistence/    storage adapters, compression, recovery, migrations
  instructions/   step plans, heuristics, layout, exports
  play/           input actions, cameras, character joints, colliders, rigs, snapshots
  automation/     public API, job registry, schemas, browser bridge
  ui/             responsive panels, keyboard/touch bindings, accessibility
  workers/        source parsing, fills, spatial preprocessing, instructions
scripts/
  build-parts.ts
  build-marketplace-mappings.ts
  validate-library.ts
  brick-cli.ts
fixtures/
  ldraw/
  projects/
  inventories/
  play/
  renders/
tests/
  unit/
  integration/
  browser/
  performance/
public/
  libraries/<release-id>/
  templates/
  notices/
```

Core unit tests must run without a DOM or GPU. Import/export and command execution must be reusable from a Node test environment. The browser renderer is a separate integration target.

### 3.3 State ownership

The document owns part references, affine transforms, colours, definitions, authoring layers, source records, instruction plans, camera bookmarks, mechanism definitions and explicit user inventory-mapping overrides. Its native metadata locks the selected mapping pack. BOM rows and XML are derived exports, not alternate authoritative documents.

Derived services own geometry, material instances, render batches, bounding boxes, connectivity candidates, collision indexes and simulation state. These caches are disposable and must be regenerable from the document plus the pinned library.

Transient interaction state owns hover, current selection, drag previews, panel positions and active tools. A drag preview must not produce hundreds of permanent undo records. A gesture commits one semantic command when completed.

### 3.4 Rendering update path

A committed command produces a document revision and a change set. The renderer processes only affected occurrences and invalidated batches. Pointer previews can update a temporary render overlay without serialising or saving the project. Saving and rendering completion are separate statuses.

Initially use part prototypes and independent scene groups as the correctness implementation. Introduce instancing behind the same adapter after correctness tests exist. The source AST must never be reconstructed from merged scene geometry.

Workers initially handle this application's parser and expensive planning tasks. Do not assume the stock LDraw loader can simply be put in a worker unchanged. Queue its initial geometry compilation, profile long tasks, and later move compatible pure compilation work into a worker or the asset build pipeline.

## 4. Canonical document and identity

### 4.1 Main concepts

A **part definition** is reusable geometry and metadata. A **part occurrence** is one placement of that definition in the build. A **submodel definition** contains ordered references and can be instantiated repeatedly. An **editor group** is an authoring selection convenience. A **layer** controls authoring scope and visibility. An **instruction step** describes assembly order. A **motion rig** describes permitted movement.

These concepts must not be collapsed into a single `Group` or one common array index.

### 4.2 Contract sketch

The following TypeScript sketches define intended shapes, not a complete standalone implementation. Deliver corresponding versioned schemas and concrete supporting types during milestone M0/M1.

```ts
type Id = string;
type Vec3 = [number, number, number];
type Basis3 = [number, number, number,
               number, number, number,
               number, number, number]; // row-major

type TransformLDU = {
  position: Vec3;
  basis: Basis3;
};

type ReferenceNode = {
  id: Id;
  kind: "part" | "submodel";
  ref: Id;
  colorCode: string;
  transform: TransformLDU;
  sourceRecordId?: Id;
};

type GeometryNode = {
  id: Id;
  kind: "geometry";
  sourceFileId: Id;
  sourceRecordIds: Id[];
  colorCode: string;
  transform: TransformLDU;
};

type ModelDefinition = {
  id: Id;
  name: string;
  nodes: Array<ReferenceNode | GeometryNode>;
};

type OccurrenceId = string; // encoded stable reference-node path

type Layer = {
  id: Id;
  name: string;
  order: number;
  parentFolderId?: Id;
  visible: boolean;
  locked: boolean;
};

type LibraryLock = {
  releaseId: string;
  manifestSha256: string;
  colorConfigSha256: string;
  connectorPackSha256?: string;
};

type Project = {
  schemaVersion: 1;
  id: Id;
  revision: number;
  title: string;
  units: "LDU";
  rootModelId: Id;
  library: LibraryLock;
  models: Record<Id, ModelDefinition>;
  layers: Record<Id, Layer>;
  defaultLayerId: Id;
  layerAssignments: Record<OccurrenceId, Id>;
  marketplace?: {
    mappingPackId: string;
    mappingPackSha256: string;
    overrides: Record<string, unknown>; // typed/validated by the mapping schema
  };
  // Also required: part-definition references, source records/files,
  // embedded assets, editor groups, instruction plans, camera bookmarks,
  // motion rigs, project metadata and migrations.
};
```

All numbers must be finite. Keep document transforms in JavaScript's double-precision numbers; GPU conversion is a render concern. Store colour identifiers as identifiers, not only RGB triples. Keep original numeric source tokens for unchanged records where practical.

### 4.3 Repeated submodels and occurrence identity

Definitions form a directed acyclic graph. An occurrence is addressed by the stable path of reference-node IDs from the root to the leaf. Display names and array positions are not identities. Encode path segments unambiguously; do not concatenate arbitrary filenames with an ambiguous separator.

A layer assignment applies to a placed leaf occurrence, not automatically to every use of a shared definition. Unassigned leaves inherit the project's default layer. This allows identical repeated rooms to belong to different authoring layers without duplicating their geometry.

Editing one occurrence inside a shared submodel defaults to **make unique/copy-on-write** for the affected instance. Offer an explicit **edit shared definition** mode with an impact preview. Copy-on-write must remap affected occurrence paths, layer memberships, groups, steps, rig endpoints and occurrence-scoped inventory overrides in the same transaction. Editing a shared definition must not silently modify occurrences in locked layers.

For initial implementation, a tested copy-on-write helper is preferable to unrestricted per-occurrence geometry overrides. Do not introduce both systems accidentally.

### 4.4 Source preservation

Keep a source-record representation alongside the semantic document: file identity, raw text, record IDs, ordering, recognised metadata and anchors to editable nodes. Preserve custom records within their original scope.

A promise to retain unrecognised text is not a promise to understand its semantics. Reordering or regrouping may invalidate third-party stateful metadata. Report that situation before destructive export. Offer a preservation-oriented export or an explicitly acknowledged normalised export, never a silent best guess.

Native round-trips must preserve project metadata exactly except documented migrations. LDraw round-trips are semantic, not necessarily byte-identical: geometry, reference meaning, colour and transforms must survive; whitespace and generated names may change.

## 5. Coordinate and transformation policy

The canonical editing and interchange space is LDraw space. The format uses negative Y as up; common grid dimensions are 20 LDU per stud spacing, 8 per plate height and 24 per brick height. Real-world millimetres are an approximate secondary display, not the physics engine's native scale. [S01]

Use a single rendering conversion:

```text
C = rotation of π around X
renderPoint = C × ldrawPoint = (x, -y, -z)
```

With unchanged LDraw-local geometry, a render-root conversion is sufficient. When geometry has itself been converted, transform bases by `C × M × inverse(C)` rather than applying a second inconsistent flip. All implementations must share one tested conversion module.

All public API coordinates must name their space. Default to `space: "ldraw"`; support `"render"` only where explicitly documented. Positions are in LDU, UI angles in degrees, quaternion order—where used—must be stated, and camera up vectors must be explicit.

Preserve the complete affine basis on import. Do not round every part to a stud, assume every origin is centred, or decompose arbitrary matrices into rotations and then lose reflection, scale or shear. Non-rigid/mirrored placements can be retained while marked unverified for physical assembly. Singular transforms require a diagnostic and must not crash picking or collision code.

Transform selection operations in world space around a chosen pivot, then convert results into each node's parent space. Support selection centroid, first selected part, a connector, the workplane origin and a typed coordinate as pivots.

## 6. LDraw import and export

### 6.1 File support and capability reporting

| Feature | P0 behaviour | Later requirement |
|---|---|---|
| `.ldr`, `.mpd`, standalone `.dat` | Import locally; type determined by contents as well as extension | Maintain regression fixtures |
| Embedded submodels and parts | Resolve in a project-local virtual filesystem | Portable dependency closure export |
| Raw polygon/line geometry | Preserve and render; manipulate as an opaque geometry object | Optional dedicated geometry editing, not required |
| Colours and back-face metadata | Implement and test against source semantics | Expanded material fidelity |
| `STEP` and `ROTSTEP` | Preserve; expose imported assembly sequence | Full instruction editing/export |
| `!TEXMAP` and embedded image data | Preserve; render available fallback; warn about absent fidelity | Tested projection/image adapter in P1 |
| Unknown metadata | Retain with anchors and scope | Additional adapters only when specified |
| Missing references | Visible diagnostic placeholder; source reference retained | User-supplied dependency resolution |

Use the official format, MPD, BFC, colour and texture specifications as normative references for the parser fixtures. [S01–S05]

Raw custom geometry is not automatically a real catalogue part. Mark it **visual-only/custom**, allow transforms, and exclude it from a purchasable-parts inventory unless the user provides a verified mapping. Preserve it in native and portable LDraw exports.

Publish a machine-readable capability report distinguishing `parsed`, `rendered`, `editable`, `roundTripPreserved`, `snapVerified` and `physicsSupported`. A file must not receive one misleading global “fully supported” badge.

### 6.2 Parsing and dependency resolution

Implement a tokenizer that preserves filename tails, whitespace-sensitive metadata payloads and original records. Accept common line-ending variants on input and emit standards-compatible text. Distinguish malformed input, unsupported input and unresolved dependencies.

Use a virtual filesystem with this application policy: explicitly embedded/project-provided files first, then the locked official library, then an explicitly enabled unofficial/custom pack. Preserve any deliberate embedded override within that project's namespace; never let it contaminate another project's cache.

Normalise separators and case for resolution while retaining original spelling for export. Reject ambiguous duplicate canonical paths. Resolve relative paths without permitting escape from the approved namespace. References must not become arbitrary network requests.

Calculate dependency closure with cycle detection and memoisation. Track both unique definitions and expanded occurrence counts: a small recursive/reference-rich file can imply an enormous model. Progressive loading must not leave the previous project partially overwritten when import fails.

Import into a staging document, report diagnostics, then commit as one replace/import transaction. A cancelled import returns to the previous document unchanged. User files are never uploaded by this workflow.

### 6.3 Export profiles

Provide four distinct profiles:

| Profile | Contents | Intended use |
|---|---|---|
| Standard model | LDraw references, submodels, colours, transforms and chosen assembly steps | Interchange with other editors |
| Portable model | MPD with custom/nonstandard dependency closure; optional licensed official closure | Reliable sharing or testing |
| Per-layer archive | One independently usable MPD per layer, plus manifest and optional complete model | Modular building/recombination |
| Native project | Full project metadata and user assets | Lossless editing continuation |

Plain `.ldr` export is appropriate when its external dependencies are known to the recipient. Prefer `.mpd` when embedded dependencies are necessary. MPD defines a main document and additional embedded files; only referenced files contribute to the assembled model. [S02]

Default LDraw export includes all authored build occurrences, including currently hidden layers. “Visible only” and “selection only” are explicit options. Reference images, guides, lights and the play character are excluded unless deliberately converted into authored geometry.

Per-layer export must preserve world coordinates so importing all layers recombines the original build. It must not recentre each layer independently. A layer crossing a submodel boundary may require filtered submodel copies or flattening; preserve complete part definitions and material inheritance. Each standalone file includes its necessary custom dependency closure.

Preserve absolute/local camera definitions and motion rigs only in the native format or clearly namespaced optional metadata. A private `!BRICKEDITOR` namespace is an application proposal, not an existing LDraw standard. Other tools may ignore it.

Keep original precision for untouched records. For edited transforms, use a documented double-precision-safe serialisation policy, normalise negative zero, and test flattened world transforms within `1e-4 LDU` across the fixture corpus. Do not silently quantise imported geometry.

### 6.4 BrickLink Wanted List XML — mandatory P0 export

Provide **Export → Parts list → BrickLink Wanted List (.xml)** on desktop and mobile, with matching automation and CLI entry points. The output is a purchasing inventory, not a scene file: it carries no transforms, cameras or instruction order. All processing stays local. Downloading/copying the XML is supported without an account; uploading it to BrickLink is a separate user action.

**External format rules.** Follow the Wanted List table in S39: the required item fields are `ITEMTYPE`, `ITEMID`, `COLOR` and `MINQTY`; `MINQTY` is not `QTY`. Wrap rows in `INVENTORY`/`ITEM` elements and emit no XML declaration. This release exports parts with item type `P`. Optional Wanted List fields include `CONDITION`, `MAXPRICE`, `QTYFILLED`, `REMARKS`, `NOTIFY`, `WANTEDSHOW` and `WANTEDLISTID`. [S39]

The older dedicated Wanted List article S35 flags itself as under construction and differs in which fields it calls mandatory. Always emit the four fields required by S39; do not weaken the profile based on the older table. Keep catalogue-inventory/collection/store XML as separate future profiles rather than mixing their tags into this one. [S35, S39]

An illustrative two-lot export is:

```xml
<INVENTORY>
  <ITEM>
    <ITEMTYPE>P</ITEMTYPE>
    <ITEMID>3001</ITEMID>
    <COLOR>5</COLOR>
    <MINQTY>12</MINQTY>
  </ITEM>
  <ITEM>
    <ITEMTYPE>P</ITEMTYPE>
    <ITEMID>3001</ITEMID>
    <COLOR>11</COLOR>
    <MINQTY>4</MINQTY>
  </ITEM>
</INVENTORY>
```

The quantities above are illustrative, not a bill of materials calculated from a user build. BrickLink identifies red as colour 5 and black as 11. Its own upload example includes part 3001. [S35, S46]

Use UTF-8, no byte-order mark, stable indentation/newlines and deterministic lot ordering. Escape user text with an XML serializer, reject invalid XML characters and emit only the selected profile's allowlisted tags. Do not insert application metadata, diagnostics, custom namespaces, DOCTYPE declarations or JSON into the XML. Put those in a separate report.

### 6.5 Inventory traversal and physical part boundaries

Generate inventory from the semantic document and source classifications, never by traversing render meshes. It must work without a canvas, WebGL or compiled geometry.

Resolve scope to a set of unique occurrence IDs in a fixed revision. Expand every referenced user submodel instance, including repeated instances; do not count an unreferenced embedded file. Stop traversal at an identified physical catalogue-part boundary. Studs, tubes, polygon subfiles, primitive references, edges and decoration geometry inside that part are not additional purchase units.

Do not assume every `.dat` file is one physical part or every `.ldr` file is a submodel. Use library/source metadata and explicit project overrides. Custom models can contain catalogue references as well as visual-only geometry. Report those categories separately and preserve source-to-BOM traceability.

Resolve the effective body colour through the occurrence path before marketplace mapping. Unresolved inherited colour, an unrecognised custom colour, or an unsupported direct colour cannot silently become black or the renderer's fallback colour. Fixed-colour printing inside a decorated part does not create separate purchase lots for its painted regions. A multi-component assembly's decomposition must describe each actual component's colour.

A library shortcut/composite requires one verified purchasing rule: either a recognised catalogue assembly or an explicit decomposition into physical components. Do not count both the composite and its components. Do not automatically combine arbitrary user-assembled figures into catalogue minifigure item IDs. The P0 target is part lots; an explicitly supported later whole-minifigure profile must be separately tested.

Treat the transient playable character, optional play ground, grids, lights, selection ghosts and camera helpers as non-authored entities; they must never enter XML. Authored figure parts follow the normal scope unless the user selects **Exclude authored figures**. That filter uses semantic tags or an explicit selection, not an unreliable filename substring. Ordinary authored parts are not removed merely because similar parts are used by a figure.

### 6.6 Mapping pack and resolution policy

The P0 distribution must include an audited, offline mapping pack covering every physical part in the starter templates and every part/colour combination advertised as purchase-ready. Broader imports are allowed outside this coverage. Do not claim whole-library marketplace support on the strength of a few matching numeric IDs.

The mapping pack has its own version, content hash, source/licence provenance and verification date. A native project locks it separately from the geometry library. Pack upgrades and user overrides invalidate inventory previews; they do not silently rename or recolour the design. The build pipeline must have permission to distribute its chosen mapping data. P0 may use a curated mapping set rather than requiring a third-party authenticated data service.

A mapping rule must identify the source namespace and definition identity, not just a bare filename. A project-local replacement named `3001.dat` must not inherit the official mapping automatically. Supported rule results are:

| Result | Application behaviour |
|---|---|
| Exact part/variant mapping | Emit the verified target identifier when colour resolution also succeeds. |
| Verified assembly decomposition | Emit declared components and multiplicities, retaining provenance to the parent occurrence. |
| Several catalogue candidates | Require a user choice; never pick the first candidate silently. |
| No part or colour mapping | Block a complete export and expose the affected occurrences. |
| Explicit substitution | Require informed confirmation; label the report as a substitution, not an exact match. |
| Visual-only/custom geometry | Report as non-orderable; require acknowledgement before any incomplete export. |

Do not generate a target item number merely by stripping `.dat`. Do not strip print/pattern/mould suffixes, merge left/right variants, choose a nearest RGB colour, or map a mirrored/scaled piece to an ordinary physical part without a diagnostic. Render appearance, catalogue identity, historical part/colour existence and current seller availability are distinct fields.

For custom colour definitions, qualify mapping by the resolved definition, including material/finish semantics, not only its integer code. Explicit user mappings must retain their origin and an acknowledged/unverified status; typing an ID does not constitute external verification. The default complete-export policy accepts verified mappings or explicit acknowledged decisions, but reports those categories distinctly.

**Completeness rule:** unresolved part IDs/colours, ambiguous composites, known-invalid part/colour combinations and unacknowledged nonphysical transforms are blockers. Missing current seller data is not: offline XML does not promise live stock. Unknown catalogue-combination coverage must be shown as unknown, not asserted valid. A user may explicitly accept that uncertainty, but cannot receive a falsely “catalogue verified” report.

### 6.7 Quantities, export scope and user workflow

The default scope is **Entire build**, including hidden and locked layers. Also offer visible layers, chosen layers, selection and a chosen submodel occurrence. Locked status prevents mutation, not read/export. Selection of both an assembly and its child must not count that child twice. Repeated submodel instances are distinct occurrences and therefore contribute independently.

Aggregate only after source resolution and verified decomposition. The basic lot key is target item type + item ID + colour. A P0 request uses one global condition and destination list. Conflicting per-occurrence purchasing preferences must be resolved in preview rather than being silently merged or assumed to create distinct remote lots. Keep layer/subassembly breakdown in the report even when one combined XML lot spans several layers.

Require positive safe-integer quantities for emitted lots. Checked multiplication/addition must detect overflow from repeated references or decomposition. An optional build multiplier is a positive integer applied to the scoped build count. Start with the full required quantity; spare quantities or stock subtraction are explicit options, not automatic guesses.

The export dialog shows source occurrence count, resolved physical-unit count, distinct lot count, mapping coverage, known/unknown colour availability, exclusions, substitutions and blockers. Selecting a problem row highlights its source occurrences and opens resolution controls. A colour/part substitution is an inventory-only decision unless the user separately requests an undoable design change.

Default condition is **Any**, represented by omitting the optional condition field; **New** and **Used** are explicit choices. Do not invent a marketplace code for “Any”. Optional target-list, remarks and purchasing fields are omitted when unset. Decimal prices use a locale-independent representation and an explicitly chosen currency context; price discovery is outside P0.

If parts-on-hand support is enabled later, choose one documented mode: export total demand with filled quantities, or export remaining shortages only. Never subtract owned parts and also mark the same owned parts as filled. Ownership allocation across separate layer files must be explicit so the same stock is not subtracted repeatedly.

Before download, validate both structure and mapping decisions. Default **Complete export** fails atomically when blockers remain. An explicit **Export resolved items only** action may produce a ZIP containing `wanted-list.partial.xml` and `inventory-report.json`; the UI must state omitted quantities prominently. Never silently drop unresolved occurrences. If there are no emitted lots, return a report without an empty upload file.

Allow **Download XML**, **Copy XML**, **Download report**, and **Export one list per selected layer**. Per-layer XML contains that layer's scoped demand; a ZIP includes a combined report. Do not assign hidden remote list IDs to layer files. The export panel explains how to use BrickLink's XML upload path and warns that re-importing into a populated list is not guaranteed to replace previous demand. [S35]

### 6.8 Inventory/agent contract and output manifest

Add `inventory.preview` and `inventory.export` to the public API. They use the same domain service as the export dialog and require no DOM or graphics context. The following is a proposed contract; implement its complete JSON Schemas in M0/M1.

```ts
type InventoryScope =
  | { kind: "all" }
  | { kind: "visible" }
  | { kind: "layers"; layerIds: string[] }
  | { kind: "selection"; occurrenceIds: string[] }
  | { kind: "submodel"; occurrenceId: string };

type BrickLinkInventoryRequest = {
  expectedRevision: number;
  format: "bricklink-wanted-xml";
  scope: InventoryScope;
  buildMultiplier?: number;       // positive safe integer, default 1
  condition?: "any" | "new" | "used";
  wantedListId?: string;
  remarks?: string;
  excludeAuthoredFigures?: boolean;
  errorPolicy?: "block" | "export-resolved"; // default block
};

type InventoryPreview = {
  previewId: string;
  documentRevision: number;
  mappingPackSha256: string;
  sourceOccurrenceCount: number;
  resolvedPhysicalUnitCount: number;
  lotCount: number;
  canExportComplete: boolean;
  rows: InventoryLot[];
  diagnostics: InventoryDiagnostic[];
};

type InventoryExportRequest = {
  previewId: string;
  expectedRevision: number;
  expectedMappingPackSha256: string;
  errorPolicy: "block" | "export-resolved";
};
```

`InventoryLot` contains BrickLink identifiers, positive quantity, requested condition and a breakdown to source occurrence IDs. `InventoryDiagnostic` contains code, severity, affected IDs, resolution options and acknowledgement status. At minimum define `UNMAPPED_PART`, `UNMAPPED_COLOR`, `AMBIGUOUS_MAPPING`, `UNRESOLVED_COMPOSITE`, `NONPHYSICAL_TRANSFORM`, `NON_ORDERABLE_GEOMETRY`, `INVALID_PART_COLOR`, `UNVERIFIED_PART_COLOR`, `QUANTITY_OVERFLOW`, `EMPTY_INVENTORY` and `STALE_INVENTORY_PREVIEW`.

A preview token binds the document revision, source scope including resolved visibility/selection, mapping-pack hash, override hash and every export option. Export rejects any mismatch or a changed preview; it must not quietly capture new visibility state. A renderer update must not affect the inventory result.

Export returns artifact bytes/MIME type/name plus a JSON manifest with document revision/hash, mapping version/hash, scope, multiplier, condition, lot/unit counts, ordered exclusions, substitutions, diagnostics, completeness and separate verification statuses. Use deterministic XML serialization; timestamps belong in the manifest, not XML. For a partial result, return the XML and report together in a ZIP. No credentials or account tokens are stored in projects or manifests.

P0 CLI examples to implement:

```sh
brick-cli inventory --input house.mpd --format bricklink-wanted-xml \
  --scope all --condition any --output house-wanted.xml \
  --report house-inventory.json

brick-cli inventory --input house.brickproj --format bricklink-wanted-xml \
  --layer ground-floor --layer roof --per-layer --output layer-wanted-lists.zip
```

A blocked complete export exits nonzero, emits the structured report and leaves any previous XML output intact. `--allow-partial` is an explicit alternative and produces a visibly partial archive, not an apparently complete list. Pin the same project and mapping inputs to obtain equivalent UI/CLI output.

## 7. Parts library and build-time pipeline

### 7.1 Distribution

Self-host a pinned official library snapshot or an approved subset on the same static origin. Store its exact release identifier and manifest checksum in each project. Updating the app must not silently substitute a different library revision into an existing build.

Create an asset pipeline that validates input licences and paths, generates a dependency graph, extracts catalogue metadata, creates thumbnails and produces immutable versioned assets. Do not depend on the demo's tiny sample collection or hotlink thousands of part files from third-party servers.

Use a manifest to resolve known paths rather than repeated trial-and-error HTTP probes. The stock loader exposes file mapping and a configurable parts-library path. Keep those integrations behind an adapter so source-parser internals are not tied to private loader caches. [S08]

### 7.2 Catalogue entries

Each entry needs: canonical identifier, original filename, description, category, keywords, dimensions/bounds, geometry hash, dependency hashes, licence/provenance, official/unofficial status, aliases, decoration/variant flags, thumbnail, and connector/collision-support state.

Keep raw source and compiled geometry separate. A geometry cache key includes the source/dependency closure hash, compiler version, material interpretation and detail level. A mutable cache indexed only by `3001.dat` is insufficient across libraries and project-local overrides.

Do not populate the public palette with every subpart or primitive. Expose these through an advanced/custom-geometry view; ordinary users should see actual usable catalogue parts. Bundle a curated starter selection and load the wider index progressively. Every starter entry also records its inventory boundary/composite status, marketplace mapping coverage and tested colour combinations. `build-marketplace-mappings.ts` emits the separately versioned pack from section 6.6; failing mappings must not be hidden by a successful geometry build.

### 7.3 Connector packs

Keep the LDCad shadow-derived pack separately versioned and attributed. Record transformations made by the conversion pipeline, distribute required share-alike notices with adapted data, and obtain review of the packaging obligations. Separating files does not by itself settle every licensing question. [S16]

Define a coverage manifest identifying connector families and parts validated by tests. Unsupported shadow directives must produce coverage warnings rather than fictitious universal support. Initial supported types should prioritise ordinary studs/tubes, then axles/pins and hinges.

### 7.4 Offline behaviour

The app shell, starter library and user-selected parts packs can be cached. Show whether a particular project is fully available offline. A first visit must not claim access to uncached library parts without a network connection.

Use Cache Storage/ordinary browser caching for immutable library assets, not localStorage. Cache eviction must never delete the only authoritative project state through application logic. If necessary assets were evicted, show a recoverable missing-pack condition and preserve the project.

## 8. Desktop, tablet and mobile interaction

### 8.1 Workspace

On a wide screen, show the part catalogue at left, the 3D canvas centrally, and a switchable Layers/Inspector/Model Tree panel at right. Place mode switching, project status and primary actions at the top. Show selection count, active layer, workplane elevation and validation state along the bottom.

On a phone, prioritise the canvas and use bottom sheets for catalogue, layers and numeric properties. Keep Place/Select/Paint and Undo/Redo accessible without opening a menu. Use a contextual action strip after selection. Layout breakpoints are based on available width, not user-agent detection; test at 360 CSS pixels as well as tablet and desktop widths.

All primary touch targets must be at least 44 CSS pixels. No essential operation may require hover, a right mouse button or a keyboard modifier. Provide named commands and accessible numeric inputs as alternatives to precision dragging. Preserve focus when panels open and close, and announce selection, placement and save status to assistive technology.

### 8.2 Camera and editing gestures

Use an explicit Navigate tool on touch devices. In that tool, one finger orbits, two-finger dragging pans and pinching zooms. In editing tools, one finger previews/manipulates the selected object; a two-finger gesture temporarily navigates. Once navigation is recognised, cancel any pending placement gesture. A pinch ending must never place a brick.

For initial phone placement, tapping chooses a ghost position and a visible Place button commits it; a Cancel button discards it. Offer an optional fast repeated-placement mode after the safe interaction works. Provide touch-accessible rotation, height and nudge controls.

Desktop supports orbit/pan/zoom controls, click selection, drag previews and optional shortcuts: `V` select, `B` place, `C` paint, `G` move, `R` rotate, `F` focus, Escape cancel, Delete remove, and standard undo/redo/copy/paste/duplicate combinations. Display shortcuts in menus and allow remapping. Text fields must not accidentally trigger tool shortcuts.

### 8.3 Canvas helpers and templates

Provide perspective, orthographic top/front/side views, orientation cube, grid scale, axis labels, adjustable workplane and named camera bookmarks. A visual floor/grid is a guide, not an inventory part. Choosing a baseplate template creates actual authored parts.

Initial original templates should include blank, a few baseplate sizes, a simple room, a small house shell and a basic vehicle chassis. Each template declares parameters, source/asset licences and required library revision. Do not distribute third-party model files merely because they are downloadable.

Workplanes can be world-aligned, aligned to a selected face/connector, or numerically defined. Support grid increments, plane elevation, rotation increment and free-placement mode. UI should show both stud/plate-friendly dimensions and exact LDU values.

### 8.4 Part selection and properties

Search by identifier, name, category and keyword. Show favourites, recent parts, related dimensions/variants and a thumbnail. Filter by decoration, colour compatibility when known, and connector-support status. Do not pretend that every theoretically selectable colour is a manufactured combination.

The inspector exposes identifier, source, colour, layer, parent submodel, position, orientation, dimensions and validation state. Advanced mode exposes the affine matrix for imported non-rigid geometry. Batch properties must show “mixed” rather than an arbitrary selected part's value.

## 9. Layers, groups and selection scope

Layers are authoring organisation, not image compositing depth and not automatic construction order. Layer reordering changes panel/instruction presets, not physical coordinates or which 3D face appears in front.

Support create, rename, duplicate, delete, reorder, folders, hide/show, lock/unlock, solo/isolate and ghost-other-layers. Provide “move selection to layer” and a visible active-layer indicator. Deleting a nonempty layer must explicitly choose deletion of its contents or reassignment to another layer.

Default **active-layer-only** mode limits mutation and selection to the active unlocked layer. Other layers may remain visible and serve as stationary snapping/collision references. An explicit cross-layer mode widens the editable scope. Hiding an object does not remove it from physical-overlap checks unless a separate validation scope explicitly excludes it.

Selection tools include click, add/remove selection, box, lasso, select matching part/colour/layer, and select connected assembly when connectivity is known. Box/lasso selection has explicit visible-surface and through-selection modes. Use an ID/depth pass or a documented equivalent for visible-surface selection; simple projected centres alone must not be presented as occlusion-correct selection.

Layer eligibility is enforced in the command service, not just by UI buttons. Query-based batch tools show counts excluded by scope. An explicit command targeting a locked occurrence fails atomically with `LAYER_LOCKED`; it does not silently mutate some targets and skip others. Hidden occurrences require an explicit `includeHidden` policy when edited through automation.

Editor groups can span layers but inherit those scope constraints. A move of a group containing a locked leaf must fail or be deliberately reduced to a clearly previewed eligible subset before commit. Grouping does not silently change LDraw submodel structure; provide a separate **Make submodel** operation when structural reuse is wanted.

## 10. Commands, history and bulk editing

### 10.1 Command contract

All document mutations go through `dispatch` or `transaction`. A command contains a schema version, command ID, expected document revision, type and validated payload. The response contains the new revision, affected IDs, ID remappings, diagnostics and any generated output IDs.

Commands must be atomic. A multi-command transaction creates one undo item. Inverse data must restore IDs, layer memberships and references as well as positions. Retrying the same command ID with the same payload must not duplicate placements; reuse with a different payload is an error. Use a bounded per-session deduplication ledger and document its persistence behaviour.

Long calculations operate against an immutable revision. They return a preview/job result and must refuse stale application with `REVISION_CONFLICT`. Cancellation terminates work and leaves the authoritative document unchanged. Do not use a new document snapshot per animation frame.

### 10.2 Required command families

| Family | Operations |
|---|---|
| Project | create, import, replace, rename, migrate, export |
| Parts | add, remove, duplicate, transform, recolour, replace definition |
| Organisation | layer CRUD/reorder/state, assign layer, group, make submodel, make unique |
| Selection/query | exact IDs, filters, bounds, matches, connected component |
| Procedural | rectangular fill, linear array, circular array, wall fill, surface paint |
| Instructions | create plan, generate, reorder/split/merge steps, assign camera/annotations |
| Photo | camera set/bookmark, render-profile set, capture image/batch |
| Play | create/edit rig, enter/exit, reset, set input, advance fixed ticks, capture pose |
| History | undo, redo, named checkpoint |

Selection and camera movement need not occupy the geometry undo stack; store their own lightweight navigation history if useful. Layer visibility/locking and instruction edits remain undoable authoring changes with a clear history label.

### 10.3 Recolour and replacement semantics

Batch recolour changes a part's body/inherited colour channels while retaining explicit decoration colours. Never mutate a shared material object so unrelated instances change. Colour changes should not rebuild geometry or invalidate collision structures unnecessarily.

Allow replacing a selected part type while preserving its layer, desired anchor and colour. Re-evaluate connectors, bounds and collisions; provide a preview when the new shape does not match the old placement. “Replace all matching” must state its layer/visibility scope and resolve stable IDs before execution.

### 10.4 Clipboard and undo storage

Clipboard data is a versioned, bounded fragment containing referenced custom definitions and applicable metadata. Pasting creates new IDs and updates internal references. Offer paste-in-place and paste-to-workplane. Fall back to internal clipboard/file export when browser clipboard permissions are unavailable.

Undo stores bounded semantic patches or inverse commands, not renderer objects or a full mesh copy. Set both a count and byte budget; show when earlier history is discarded. Saving the project need not save an unlimited undo history. Explicit named checkpoints are independent portable recovery points.

## 11. Snapping and geometric validation

### 11.1 Three placement modes

**Grid mode:** quantise a selected anchor on a workplane using configurable increments. Defaults should suit stud spacing and plate height, with finer options clearly available. Grid alignment is not a claim of physical compatibility.

**Connector mode:** align compatible connector frames using validated metadata. Show snap candidates and allow cycling between plausible connections. Preserve intentional rotational freedom rather than always forcing one arbitrary angle.

**Free mode:** accept arbitrary transforms and keep imported off-grid work intact. Display validation information rather than blocking creative geometry categorically.

### 11.2 Connector representation

A connector record needs a stable ID, local frame, family/profile, gender or compatibility class where applicable, axial/radial dimensions, allowed orientations, insertion directions, degrees of freedom, tolerances, provenance and confidence. Source metadata may expand into multiple concrete connector sites.

Connector matching should use a spatial index, then profile/frame checks. For a selected source connector, find nearby compatible targets, construct candidate transforms, test tolerances and occupancy, score by cursor distance/rotation/change from the current preview, and retain the previous choice with hysteresis to avoid flicker. Candidate acceptance must consider compatibility beyond proximity.

The initial adapter must account for supported include/clear/inheritance and grid directives in its chosen shadow-data subset; unsupported constructs lower coverage rather than being discarded invisibly. The source meta documentation explains these families and their parameters. [S17]

### 11.3 Collision policy

Use broad-phase transformed bounds to find possible conflicts. For regular bricks, use authored analytical occupancy/clearance profiles; for irregular parts use progressively more detailed proxies or optional mesh queries. Bounding-box overlap is only a possible-conflict signal.

Legitimate mating features must not be rejected merely because coarse boxes overlap. Use validated mating clearances/proxies and connector context. Conversely, generic touching or triangle intersection is not proof of a legal connection.

Maintain separate statuses: `connected`, `supported`, `intersecting`, `unverified`, and `nonphysicalTransform`. Do not collapse all of them into a green/red buildable flag. Engineering strength, clutch forces and legal assembly techniques are outside the initial validator.

Allow deliberate invalid/free placements after a clear user policy choice. Headless commands can request strict refusal. Export must retain the authored placement and attach/report diagnostics rather than silently moving it into a “better” location.

## 12. Batch filling and procedural tools

### 12.1 P0 rectangular fill

Input includes workplane, cell mask/rectangle, chosen part or allowed part set, orientation set, colour, target layer, height, anchor and maximum additions. Offer preview, part count, unresolved cells and one-command commit/undo.

For one selected regular part, tile its verified footprint over eligible cells. For an allowed set, use a deterministic largest-fit heuristic with stable tie-breaking. An optional small bounded exact-cover search can optimise small regions later. Do not label greedy placement as globally optimal.

Occupancy is evaluated against the configured build scope, including hidden authored parts by default. Use connector/footprint offsets, not an assumption that each mesh origin is its bottom-left corner. If no allowed part fills a gap, leave a reported gap; never invent a fractional part.

### 12.2 Additional procedural operations

Linear arrays accept count and spacing/vector. Circular arrays accept centre, radius, count, angular interval and orientation policy. Wall fills accept height, thickness, allowed parts and staggered-seam preference. Surface paint can change compatible connected or same-colour regions, with its adjacency definition displayed.

P1 may add parametric fences, straight/curved stairs, roof courses and room shells. Every output remains ordinary editable placements, with optional retained generator parameters. Changing the parameters previews a replacement transaction; it must not overwrite manually edited generated parts without an explicit reconciliation choice.

Randomised variation requires an explicit seed. Expensive fills run in a worker with bounded work and a cancellation path. A preview counts both existing and generated parts against model limits. Committing stale previews is prohibited.

## 13. Renderer and performance architecture

### 13.1 Correctness first

Keep a non-instanced reference renderer for the conformance corpus. Match body colours, fixed-colour decoration, edge colours, normals and back-face behaviour before optimising. The colour/BFC semantics come from their dedicated format extensions. [S03, S04]

Maintain independent representations for surfaces, ordinary lines and conditional lines. A naïve wireframe of all polygon edges is not equivalent. Any instanced conditional-line path must transform its endpoints and control points consistently with the corresponding surface instance.

### 13.2 Geometry sharing and instancing

Share immutable part geometry; use material-slot bindings for inherited versus fixed colours. Cache colour/material variants without mutating shared bindings. Bucket opaque compatible occurrences by geometry/material layout and spatial/visibility grouping. Keep reflected, non-rigid, transparent or otherwise unverified cases on the reference path until dedicated tests prove their optimised implementation.

Instance indices are transient render addresses. Maintain mappings from occurrence ID to render handle and back. Repacking an instance buffer, hiding a layer or changing a part's colour must not change what the selection points to. Updated instance buffers and bounds must be explicitly marked/recomputed as required by the selected three.js implementation. [S28]

Do not map arbitrary authoring layers directly onto renderer-layer bitmasks. Authoring visibility is evaluated before or during render-batch population. Use normal resource disposal and reference counting; deletion of one occurrence must not dispose geometry still used elsewhere.

### 13.3 Picking and selection

Use coarse occurrence bounds before per-part ray tests. Apply local-space acceleration structures where profiling justifies them. Reuse geometry-level BVHs across occurrences rather than constructing one per identical brick. `three-mesh-bvh` is a suitable MIT-licensed candidate for these queries. [S18]

GPU ID picking must encode stable lookup entries, exclude ineligible/hidden geometry, and correctly map results back after render-batch changes. A click must select a whole authored part, not an internal stud submesh. Advanced source-geometry editing can use a separate mode.

### 13.4 Quality profiles

Provide Fast, Balanced and Photo profiles. Independently control shadow quality, ambient effects, edge visibility, transparent-material quality, environment resolution and device pixel ratio. Adapt interactive quality during dragging without altering geometry or saved export presets.

Render on demand when the scene is idle; render continuously for active camera damping, animation or play. Large file loads should show progressive diagnostic geometry and progress without blocking input indefinitely. Context-loss recovery must recreate GPU resources from the retained document and caches.

Optional path tracing is a later Photo adapter, not the editing baseline. The existing `three-gpu-pathtracer` project is a candidate, but line overlays, alpha, materials, resource use and the exact pinned three.js compatibility need testing. [S32]

## 14. Persistence, native files and recovery

### 14.1 Native project format

Use a versioned `.brickproj` ZIP bundle containing `project.json`, imported/custom source files, embedded images, a manifest and required notices. Do not include the ordinary official library by default; identify it through the library lock. Offer an explicit fully portable pack when licences and size permit.

The native format preserves layers, source records, camera bookmarks, instruction layouts, generator parameters and motion rigs. Standard LDraw is the interoperable geometric representation, not the sole backup for application-specific state.

### 14.2 LocalStorage adapter

The first persistence adapter stores compact, optionally compressed snapshots and project-index metadata in localStorage. It must never store the entire parts catalogue, compiled meshes, ordinary thumbnails or exported PNGs there. Small user-owned sources/assets can be included, but quota checks may prevent persistent saving of a large session.

Use an interface such as `list/load/save/delete/exportBackup`, allowing an IndexedDB implementation without changing document or command code. Do not silently migrate the user's authoritative storage choice during P0.

Debounce autosave after committed commands, targeting roughly 750 ms of inactivity and a bounded maximum delay of about 3 seconds when feasible. These are application targets, not browser guarantees. Drag previews do not trigger autosave. Show `unsaved`, `saving`, `saved revision N` and `save failed` distinctly.

### 14.3 Recovery protocol

Write a new revision under a fresh key, verify its envelope/checksum, then update the project head pointer. Only after that succeeds may older owned snapshots be garbage-collected. Keep a last-known-good revision while quota permits. On startup, recover from a missing/corrupt head using validated snapshots.

This is an application-level recovery protocol, not a claim that localStorage offers multi-key transactions. Account for temporary double-storage requirements. Never delete the only good snapshot to attempt a larger save. On quota failure, keep the in-memory project, retain the previous good revision and prominently offer a native file export.

Track application-owned byte estimates, but treat successful/failed writes as authoritative; browser quota accounting is not a portable exact byte counter. Do not use an origin-wide storage estimate as a guarantee of available localStorage capacity.

Autosave is not a substitute for file backups. Browser storage can be cleared or unavailable, especially in private sessions. The UI must not claim that a project is permanently backed up merely because a save succeeded. [S23, S24]

### 14.4 Multiple tabs and migration

Use a single-writer lock where supported, with revision checks and inter-tab notification. Fall back to opening a conflicting tab read-only or prompting for a fork; never silently overwrite a newer revision. An explicit clone creates a new project ID.

Each schema migration has fixture tests and a backup path. Opening a newer unsupported schema must preserve the original bundle and fail safely rather than resetting it. Persist successful migrations only after the resulting document validates.

## 15. Static sharing and hosting

### 15.1 Self-contained links

A small project/model can be encoded into a URL fragment:

```text
/#v=1&codec=deflate&format=mpd&data=<base64url-payload>
```

The fragment is not part of the HTTP request target, but remains accessible to page scripts and may be stored in history or copied by other software. It is not encryption or access control. [S25]

Define a product soft limit of 8 KiB for the complete generated link and a hard generation limit of 32 KiB, pending browser/messaging tests. These are deliberate compatibility limits, not universal browser limits. Count the final encoded URL, not the uncompressed model size.

For native shares, exclude local-only recent-file metadata, undo history and unnecessary author details. Show exactly what is included. Include library version information and any small required custom geometry. Link import opens a temporary project preview; it must never overwrite an existing saved build without an explicit command.

Bound both compressed input and decompressed output. Use versioned codecs and envelope validation; checksums detect corruption but do not authenticate the author.

### 15.2 Larger models

For larger builds, offer a portable file. Optional explicit remote-file import can fetch a user-provided HTTPS URL only when CORS and policy permit. A short immutable content-hash URL is only possible when the bytes are already hosted somewhere; a static app cannot make arbitrary local content available to another device merely by naming its hash.

Do not introduce a secret API key, hidden proxy or upload service to fake a backend-free sharing claim. Any future hosting integration must be optional, consented and separately documented.

### 15.3 Deployment

The production output must work from an ordinary static HTTPS host, including a subdirectory base path. Prefer query/hash-based modes or provide documented static-route fallbacks. No server-side rendering is required. Build-time scripts, a development server and a local headless test runner do not imply a production application backend.

A service worker may cache versioned assets. An app update must not delete a library snapshot still required by a local project without an explicit cache-management policy. Keep source data recoverable even when offline assets are incomplete.

## 16. Photo mode and image export

### 16.1 User-facing controls

Expose projection, camera position/target/up vector, field of view or orthographic span, zoom, clipping distances and named camera bookmarks. Provide exterior presets, orbit controls, fly controls and an interior-position mode. Entering exact coordinates must not subsequently trigger automatic fit-to-model.

Interior capture is ordinary camera positioning, not a separate renderer. Allow a small positive near plane, warn about camera intersections, and provide optional roof/layer isolation and clipping planes. Clipping changes the view only; it must not delete exported build geometry.

Expose transparent/solid/gradient/environment background, ground visibility, shadow catcher, environment rotation, exposure, tone mapping and a bounded light rig. Lights need position or direction, colour, intensity and shadow settings. Background and lighting are independent: a transparent background can still use an environment for illumination.

Store settings in a versioned `RenderProfile`. Every render request must specify its visibility policy: `all`, `current`, or an explicit layer set. The Photo UI can default to `current`; automation examples should use `all` or an explicit set to avoid accidental dependence on a hidden editing layer.

### 16.2 Capture pipeline

Capture a fixed document revision and render profile. Resolve required assets, finish render-adapter updates and shader preparation, render into an offscreen target, apply the chosen output colour/tone pipeline, read pixels, correct orientation/alpha handling, and encode a Blob. Restore interactive renderer state in a `finally` path.

Do not rely on a screenshot of the entire application, an arbitrary timeout or permanently enabling `preserveDrawingBuffer`. The WebGL renderer has render-target, shader-preparation and readback facilities suitable for a dedicated export path. [S26]

PNG is required in P0. JPEG/WebP are optional after tests; JPEG must composite onto an explicit background. Width/height are output pixel counts and independent of device pixel ratio. Reject impossible dimensions before allocation. Start with conservative total-pixel limits, particularly on phones, and expose the reason for refusal.

Larger-than-device targets may use tiling in P1. Tiling needs tests for projection, shadows, screen-space effects and seams; it is not correct merely to stitch independently framed screenshots. Optional path tracing must render a fixed sample count/seed against a frozen snapshot and report its limitations. [S32]

### 16.3 Render manifest

Return the image together with JSON containing document ID/revision/hash, library/asset hashes, app/renderer versions, camera, visibility policy, lights, background, output dimensions, quality settings, simulation tick if any and all warnings.

Aim for reproducibility within a pinned browser/renderer environment. Do not promise bit-identical GPU pixels across operating systems and graphics drivers. Use toleranced image tests and structural manifest comparisons; exact byte hashes remain useful within a controlled capture environment.

## 17. Headless and agent interface

### 17.1 Public browser API

Expose `window.brickEditor` in the documented automation mode. This is an application API that must be implemented; it is not an existing three.js API. UI adapters call the same underlying services.

```ts
interface BrickEditorAPI {
  readonly apiVersion: "1.0";
  capabilities(): Promise<CapabilityReport>;
  ready(options?: {
    minRevision?: number;
    strict?: boolean;
  }): Promise<ReadyReport>;

  project: {
    import(input: ImportRequest): Promise<ImportResult>;
    export(input: ExportRequest): Promise<ExportArtifact>;
  };

  inventory: {
    preview(input: BrickLinkInventoryRequest): Promise<InventoryPreview>;
    export(input: InventoryExportRequest): Promise<InventoryExportArtifact>;
  };

  query(input: QueryRequest): Promise<QueryResult>;
  dispatch(input: CommandEnvelope): Promise<CommandResult>;
  transaction(input: TransactionRequest): Promise<CommandResult>;

  camera: {
    set(input: CameraSpec): Promise<void>;
  };

  render: {
    image(input: RenderRequest): Promise<{
      blob: Blob;
      manifest: RenderManifest;
    }>;
  };

  // Registered when P1 basic exploration is implemented; vehicles are separate.
  play?: {
    enter(input: PlayRequest): Promise<PlaySnapshotReport>;
    setInput(input: PlayInput): Promise<void>;
    setCameraMode(mode: "first-person" | "third-person"): Promise<void>;
    setLocomotion(mode: "walk" | "fly-noclip"): Promise<PlaySnapshotReport>;
    teleport(input: PlayTeleportRequest): Promise<PlaySnapshotReport>;
    stepTicks(count: number): Promise<PlaySnapshotReport>;
    exit(): Promise<void>;
  };

  jobs: {
    status(id: string): Promise<JobStatus>;
    cancel(id: string): Promise<void>;
    wait(id: string): Promise<JobResult>;
  };
}
```

Changing the current camera through `camera.set` is transient and does not advance the authored document revision. Saving or updating a camera bookmark is a separate document command.

The supporting schemas must define all enums, required fields, limits and units. Reject unknown dangerous fields rather than passing them into renderer or library internals. Expose no `eval`, arbitrary script execution or automatic URL-provided command execution.

### 17.2 Readiness contract

`ready` means the specified revision has been applied to the renderer, required dependencies have resolved, tracked geometry/texture preparation has finished, and a complete frame can be captured. It is not equivalent to DOM load, HTTP network idle or two animation frames after opening a file.

`strict: true` refuses unresolved parts and unsupported visual features. A diagnostic preview can set strict false and receives warnings. An explicitly approximate image must be labelled in its manifest. Imported source preservation does not override a strict requirement for accurate rendering.

The capture call takes a snapshot revision and returns that revision in the manifest. Concurrent edits must either be isolated from that snapshot or produce a revision-conflict error; a partially old/partially new image is unacceptable.

### 17.3 Command envelope example

```json
{
  "schemaVersion": 1,
  "commandId": "paint-ground-floor-001",
  "expectedRevision": 12,
  "type": "parts.recolor",
  "payload": {
    "occurrenceIds": ["root/ref-a/brick-1", "root/ref-a/brick-2"],
    "colorCode": "4",
    "includeHidden": false,
    "preserveFixedColors": true
  }
}
```

This example uses already resolved occurrence IDs. A separate query can find all matching parts in a layer and return both IDs and their revision. The command must check that revision. IDs shown here are illustrative; the delivered encoder/decoder defines their exact escaping rules.

Dry-run support is mandatory for transforms, replacements, bulk filling and instruction generation. Return proposed changes, counts, bounds and diagnostics before applying them. Commands that add geometry accept a maximum-additions budget and a deterministic seed when applicable.

### 17.4 Query and diagnostic data

Queries must retrieve occurrences by identifier, colour, layer, submodel, bounding region, selection and connectivity state. Also expose part counts, bounds, unresolved references, intersecting candidates, unsupported transforms and missing connector coverage. Return identifiers an agent can act on, not only human-readable descriptions.

Errors have a stable code, message, severity, relevant occurrence/source-record IDs and structured details. Minimum codes are `INVALID_INPUT`, `REFERENCE_MISSING`, `REFERENCE_CYCLE`, `LIMIT_EXCEEDED`, `LAYER_LOCKED`, `REVISION_CONFLICT`, `UNSUPPORTED_RENDER_FEATURE`, `INVALID_TRANSFORM`, `STORAGE_QUOTA`, `WEBGL_UNAVAILABLE` and `CANCELLED`.

Do not hide errors in console logs. Jobs expose progress and terminal success/failure/cancellation. Headless output must be useful even when WebGL is unavailable: source validation and exports can still function independently where their requested operations permit.

### 17.5 Playwright capture example

The implementation should support a workflow with this shape. Playwright runs JavaScript in the page context through `evaluate`; browser objects such as Blobs need explicit serialisation when returned to Node. [S27]

```js
import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:4173/?automation=1");
  await page.waitForFunction(() => window.brickEditor?.apiVersion === "1.0");

  const modelText = await readFile("build.mpd", "utf8");
  const capture = await page.evaluate(async (text) => {
    const api = window.brickEditor;
    const imported = await api.project.import({
      format: "ldraw", text, strict: true
    });
    await api.ready({ minRevision: imported.revision, strict: true });
    await api.camera.set({
      space: "ldraw",
      projection: "perspective",
      position: [40, -60, 40],
      target: [40, -60, -80],
      up: [0, -1, 0],
      fovDeg: 60,
      near: 0.5,
      far: 10000
    });
    const result = await api.render.image({
      revision: imported.revision,
      width: 1600,
      height: 1200,
      format: "png",
      visibility: { mode: "all" },
      background: { type: "solid", color: "#ffffff" },
      quality: "photo",
      strict: true
    });
    return {
      bytes: Array.from(new Uint8Array(await result.blob.arrayBuffer())),
      manifest: result.manifest
    };
  }, modelText);

  await writeFile("interior.png", Buffer.from(capture.bytes));
  await writeFile("interior.render.json", JSON.stringify(capture.manifest, null, 2));
} finally {
  await browser.close();
}
```

For large image batches, replace array serialisation with a bounded/chunked transport or controlled download transfer. The example demonstrates the contract, not an optimal high-resolution transport.

### 17.6 CLI delivery

Deliver a local CLI around the same domain/API contracts with commands for validate, apply command JSON, render camera sets, export LDraw, **export BrickLink Wanted List XML** and generate instructions. Inventory generation runs in Node without launching Chromium; renderer-dependent commands use the browser adapter. Inventory flags and failure semantics are defined in section 6.8. It may launch a local static server and Chromium; no remotely hosted rendering service is required.

An agent workflow is: import → inspect structured diagnostics → query IDs → dry-run commands → commit → validate → render named exterior/interior views → export project/model, BrickLink XML with its resolution report, and image manifests. Tooling can later wrap this contract in an external agent protocol without rewriting the editor.

CI must detect WebGL/renderer availability and record whether capture used hardware or a software implementation. Ship a tested browser/container configuration rather than assuming every headless Chromium environment has working GPU support. Pin browser and package versions and keep the graphics fallback explicit.

## 18. Construction instructions

### 18.1 Instruction-plan model

Store instruction plans separately from geometry and layer order. A step contains IDs of newly introduced occurrences or referenced subassembly operations, camera/rotation settings, notes, arrows, exploded offsets and layout preferences. It can retain links to source steps without requiring source-file order to equal the current editor layer order.

Keep repeatable subassemblies as reusable instruction sections with instance counts when practical. Counts must reflect placed catalogue parts, not internal render primitives. A catalogue shortcut/composite requires an explicit inventory decomposition if it is to expand into separately purchasable items.

Instruction editing supports create/delete/reorder, split/merge, drag additions between steps, subassembly callouts, repeat counts, camera changes and notes. Display old parts subdued and new parts highlighted, with a parts-needed panel and a cumulative model view.

### 18.2 Three generation strategies

**Existing steps:** use imported structure first when available. Preserve source step and rotation records even where the initial viewer has not yet implemented a rotation interpretation. P1 must have dedicated camera-conversion fixtures for rotation metadata.

**By layer:** the user chooses an ordered list of layers. Within a layer, split by a configurable maximum additions count and optional connected/spatial groups. Label this an organisational plan; a roof layer placed first is not made physically valid merely by appearing first in a list.

**Assisted assembly planning:** build a draft plan from supported connections, contacts, insertion directions, clearance and user constraints. It is a bounded deterministic heuristic, not a universal assembly solver. The user can review and override it.

Web Lic is a useful reference for instruction UX, and `buildinginstructions.js` is a candidate source of reusable instruction-oriented components subject to compatibility work. Neither its existence nor an automatic-generation service proves that arbitrary imported geometry admits an automatically valid sequence. [S12–S14]

### 18.3 Heuristic pipeline

First resolve leaf occurrences, verified connector candidates, known support contacts, user-designated roots and imported/user ordering constraints. Analyse subassemblies in their own assembly/workplane frames where necessary; not every final-world placement is built in its final orientation.

At each iteration, find placements connected/supported by the already assembled set or an explicitly defined subassembly root. Prefer candidates with a plausible unobstructed insertion path. Use explicit connector directions for sideways or axle-like insertions; do not assume all pieces descend vertically.

Score eligible candidates using stable rules: accessibility, visibility, spatial locality, fragile/cantilever warnings and consistency with user constraints. Height is only one tie-breaker, calculated from relevant geometry/support features, not just a part origin or the raw sign of Y.

Combine independent additions into readable steps. A grouped step must not hide an unresolved within-step dependency; either maintain a documented internal order or split it. Use a configurable additions budget, initially around 6–12 additions per generated step, then let the user change it.

If planning stalls, identify the unresolved component or constraint cycle. Propose a subassembly or ask for an authoring decision in the UI. Do not quietly break ordering constraints to manufacture a complete-looking plan. Automation returns an incomplete/draft plan plus structured unresolved IDs rather than reporting verified success.

Finally validate coverage: every intended part occurrence is introduced exactly once through the plan's expansion, required parent subassemblies precede their use, and all rejected/unverified checks remain visible. Retain the method, seed, input revision and coverage report.

### 18.4 Camera and layout

Start with a small deterministic set of candidate views and choose views that expose newly added parts while limiting unnecessary viewpoint changes. Allow manual locks per step. A visibility score is a readability aid, not proof of assembly feasibility.

Generate interactive HTML steps, individual PNGs, an instruction-plan JSON file and a printable PDF. P0 can provide basic layer-step previews/PNGs; P1 adds paginated PDFs, cover, callouts and inventories. Generate page images sequentially to bound memory, then compose the PDF in the browser. `pdf-lib` is a candidate for that composition. [S29]

When exporting a plan back to LDraw step records, respect submodel boundaries and source-preservation diagnostics. Keep rich page layouts, arrows, review status and algorithm diagnostics in the native project or a separate plan file; they are not universally portable LDraw semantics.

## 19. Playable world and mechanisms

### 19.1 Basic exploration — P1, independent of vehicle physics

Create an Explore/Play session from a fixed document revision. Deliver the simple navigation experience before implementing vehicles, articulated machines, dynamic assemblies or rigid-body interaction. First person is the default camera. A visible player body, arms, hands, reflection or shadow is **not required in first person**. The collision controller still exists independently of any visible avatar.

Offer **Walk** and **Fly / pass through walls** as explicit modes. Walk is the default when a safe spawn exists; otherwise enter free flight with a clear state label and offer spawn selection. Free flight has no gravity or environment collision and must remain available while collision preprocessing is unavailable or unsupported. This is a useful building-inspection tool, not a claim that the build is traversable.

Keep camera mode independent from movement mode: first/third person can share the same player state. Do not create separate first-person and third-person physics controllers or teleport the actor just to change the camera.

#### 19.1.1 Controls and interaction state

Use an action layer consumed by both human input adapters and the agent API:

| Action | Desktop default | Touch default |
|---|---|---|
| Move horizontally | W/A/S/D, with remapping | Left virtual stick |
| Look | Mouse after explicit pointer-lock entry; drag-look fallback | Right-side drag area |
| Move faster | Hold Shift; optional toggle | Run toggle |
| Jump / fly upward | Space | Jump / Up button |
| Fly downward | Control while flying | Down button |
| Walk / free-flight toggle | F | Explicit mode button |
| First / third person | V | Camera button |
| Pause / release input | Escape | Menu button |
| Respawn / choose spawn | Pause-menu action | Pause-menu action |

The bindings are this application's defaults, not a promise to reproduce every Minebench key. Use on-screen hints that change with the current mode. Prevent scrolling only when the canvas owns the relevant gameplay input. Pointer lock is opt-in after a user gesture; three.js supplies a suitable mouse-look control, not a collision engine or touch controller. [S43]

Normalise combined movement input to avoid faster diagonal movement. Walking follows camera yaw on the ground plane, not camera pitch; flying may follow the full look direction. Clear held actions on blur, pause, lost pointer lock, touch cancellation and mode exit. A key held while opening a text field must not continue moving the player. Cancel the session safely if the source project is replaced.

Touch input must use pointer identities/capture for simultaneous move/look/jump. Keep usable controls within safe screen insets and out of system-gesture areas. A phone user must not need a hardware keyboard, pointer lock or double-tap timing. Support reduced motion; view bob, camera roll, automatic FOV shifts and decorative camera shake default off.

#### 19.1.2 Player state, scale and collision

Store feet/root position, yaw, view pitch, velocity, grounded state, locomotion mode and movement intent separately from the rendering camera. Define public positions/lengths/speeds in LDU and LDU/second. Convert through the same tested scale adapter used by mechanisms. A proposed gameplay scale remains 20 LDU per 0.4 simulation metres; this is a gameplay choice, not the physical brick dimension display.

Select capsule radius, height and eye offset from an explicit character profile in LDU. Test that profile against supplied doors and stairs. Do not copy Minebench's player dimensions in voxel units into LDraw, and do not silently rescale either the model or avatar to fit every opening. The visible avatar's foot/root anchor must match the collider's foot/root anchor.

For walking, use a kinematic capsule with gravity, grounded jump, wall sliding, bounded step-up, slope limits, ceiling collision, spawn validation and respawn. A Rapier character-controller adapter is the preferred initial implementation because it supplies movement correction, autostepping and ground snapping. This does not require dynamic simulation of every brick. [S19, S21, S22]

Build a spatially indexed static collision representation from catalogue proxies and supported mesh surfaces. Use boxes/compound solids for simple parts, wedges or mesh proxies for slopes, and opening-preserving proxies for hollow frames. Avoid a single convex hull around a house or a filled box around a window frame. Smooth insignificant stud detail only as a declared play approximation. Transparent glass is not automatically non-colliding; material visibility and collision policy are separate.

A coarse voxel grid may be a broad-phase acceleration structure, never the authoritative shape of arbitrary imported geometry. Do not rasterise all brick shapes onto one stud-sized occupancy grid to make a voxel controller fit. That would change openings, slopes and thin elements. Use swept collision/shape queries rather than only checking an endpoint, including at fast movement speeds and low frame rates.

If the player exits free flight while inside a wall, validate/recover to a safe nearby or last-known-safe pose, or refuse the change with an explanation. Never enable gravity in an unresolved penetration. Optional play-only ground/fall boundaries belong to session settings and never become inventory parts.

#### 19.1.3 First-person camera

Attach an eye-anchor camera to the player state with configurable height, field of view and small positive near plane. Keep the actor collider while suppressing every player visual mesh and its default shadow in first person. It is valid not to load the avatar asset until third person is requested.

Camera pitch does not require pitching a physical figure's head. The first-person view is a navigation tool. Do not add body-awareness, hand interactions, mirrored-body rendering or weapon-style animations to this milestone.

Provide an action to save the current view as a normal photo bookmark. Headless image capture remains independent of pointer lock or active keyboard input, and uses the exact frozen camera when requested.

#### 19.1.4 Third-person camera

Use a following/orbiting camera aimed near the torso, with adjustable distance, yaw/pitch limits and frame-rate-independent damping. Keep movement camera-relative and turn the figure's root to face its travel direction; the first version need not include specialised strafing animations.

Sweep a small camera collision volume between the follow target and desired camera position, shorten the arm before obstacles and restore it smoothly afterwards. A single line ray is insufficient to protect the camera's near-plane footprint. Test inside rooms, near ceilings and while walking through narrow doors. If the camera comes too close to the avatar, fade or hide the avatar locally rather than clipping through it or altering the authored building.

#### 19.1.5 Rigid-part character and joint animation

Use an original/licensed brick figure or a user-supplied, correctly attributed compatible asset. A **rigid hierarchy of meshes/groups** is sufficient. No skinned mesh, vertex deformation, motion capture, inverse kinematics, ragdoll, elbow bending or knee bending is required.

The default rig profile has these declared motions:

| Node/pivot | Allowed default motion |
|---|---|
| Root/pelvis | World translation and heading; not an invented body joint |
| Torso relative to pelvis | Fixed |
| Head at neck | Yaw about the declared neck axis |
| Left/right shoulder | One hinge axis per arm |
| Left/right hip | One hinge axis per leg |
| Left/right hand sockets | Optional axial rotation where the chosen asset supports it |
| Hat/hair/accessories | Fixed to the appropriate parent unless explicitly rigged |

These are application rig requirements for the selected figure, not automatic mechanical inference for every minifigure variant. Store local pivot, unit axis, rest transform and tested limits for each joint. Do not rotate a limb about its mesh bounding-box centre. Keep camera pitch separate from neck motion when the rig has no pitch joint. LDraw's `!AVATAR` directive is category metadata, not a playable-character rig. [S33]

Implement idle, walk, run, jump and fall states procedurally. Advance gait phase using actual horizontal distance travelled after collision correction, not key presses or the render-frame count. Opposing hip hinges alternate; arms swing opposite their corresponding legs; amplitude increases modestly for running. Blend to neutral while stopped or blocked by a wall and use simple bounded airborne poses. No sophisticated foot planting is necessary.

A proposed gait definition is `phase += 2π × travelledDistance / strideLength`, with signed sinusoidal hip/shoulder offsets clamped to the rig's configured limits. Backward or camera-relative travel must have a documented heading/phase policy, and collision must never be computed from a swinging arm's decorative mesh.

The collision capsule is the only mandatory physical player body. Joints animate visual transforms without starting a physics motor on every limb. Figure animations and optional shadows are presentation state and must not create document edits or extra BrickLink lots.

#### 19.1.6 Simulation and automation

Use a fixed 60 Hz movement tick and render interpolation, with bounded catch-up after slow frames. Paused/background tabs do not accumulate unlimited simulation debt. This is a new application requirement; do not describe Minebench's variable-frame subdivision as identical to a fixed-tick deterministic replay contract.

`play.enter` fixes the document revision/profile and reports collision/avatar readiness. `play.setInput` sets a bounded action vector; `play.setCameraMode` changes presentation; `play.setLocomotion` performs safe mode transitions; `play.teleport` validates a target unless an explicit free-flight policy is requested; and `play.stepTicks(n)` advances a bounded number of ticks without real keyboard events. `play.exit` restores editor controls and view.

Manifests include source revision, play profile, units/scale, feet position, camera mode, movement mode, joint state or reproducible animation phase and tick. Verify reproducibility in the pinned engine/browser environment rather than promising bit-identical cross-platform floating-point simulation.

### 19.2 State isolation

Play state must not continuously write transforms into the authored document. Entering Play freezes a revision; exiting resets to the editor state. Provide an explicit, undoable “apply current pose” operation when requested, with revision checks and unsupported-transform diagnostics.

Render visibility and play-world inclusion are separate profiles. By default, use all authored physical build geometry in Play unless an explicit play profile excludes layers. Hiding a roof for editing must not accidentally remove unrelated collision floors from the world.

If the document changes while a play snapshot exists, pause/rebuild or require re-entry. Do not apply a stale vehicle pose to a different set of occurrence IDs.

### 19.3 Motion-rig schema

A rig identifies rigid groups, their member occurrence IDs, rest transforms and optional colliders/mass settings. A joint identifies two groups, type, local anchors, local axes, limits and optional motor settings. Controllers map named inputs such as throttle, steering or open-door to joint/rig actions.

```ts
type JointSpec = {
  id: string;
  bodyA: string;
  bodyB: string;
  kind: "fixed" | "revolute" | "prismatic" | "spherical";
  anchorA: Vec3; // local to body A, LDU
  anchorB: Vec3; // local to body B, LDU
  axisA?: Vec3;
  axisB?: Vec3;
  limits?: [number, number]; // contract specifies degrees or LDU by kind
  motor?: {
    mode: "position" | "velocity";
    target: number;
    maxEffort: { value: number; unit: "N" | "N*m" };
  };
};
```

For revolute joints, public limits and position targets are degrees, velocity targets are degrees/second, and maximum effort is torque in simulation N*m. For prismatic joints, limits and position targets are LDU, velocity targets are LDU/second, and maximum effort is force in simulation N. Mass is kilograms; gravity is simulation metres/second squared. Convert at the physics boundary using the declared gameplay scale. In the first rig schema, fixed and spherical joints do not accept this scalar motor or the two-value limit field; reject those combinations rather than guessing a motor axis. These parameters describe the chosen simulation, not measured real-world brick clutch strength.

### 19.4 Kinematics before full physics

First implement authored door hinges, rotating axles and a simple kinematic vehicle rig. Users select a chassis and wheel groups, specify wheel axes/radius and designate steering wheels. Visual wheel rotation follows travelled distance divided by wheel radius using consistent units. A planar steering model is sufficient initially; label it kinematic rather than realistic suspension simulation.

Next implement optional dynamic rigid assemblies and constrained joints. Rapier supports the relevant joint families and motor control, but the source LDraw model does not automatically tell the application which parts are rigidly coupled or which motor should drive them. [S20]

Dynamic bodies need appropriate convex/compound proxies. Do not turn every brick into an independent rigid body by default. That would be expensive and would not reproduce construction-toy connectivity or clutch behaviour. Unsupported dynamic collider shapes produce an actionable diagnostic.

Use a fixed simulation tick, initially 60 Hz, with rendering interpolation and bounded catch-up. Expose `stepTicks(n)` for controlled automation and keep deterministic seeds/settings in manifests. Do not promise numerical identity across unpinned engine versions or all hardware.

### 19.5 Persistence and export

Rig definitions persist in native projects and can optionally be included in namespaced application metadata. Standard LDraw exports the rest pose by default, or an explicitly requested static posed snapshot. General third-party LDraw viewers are not required to understand this application's mechanics.

A future auto-rig assistant may propose joints from connector metadata, but user confirmation and confidence labels remain necessary. It must never claim that importing an arbitrary car makes it a correctly driveable vehicle automatically.

### 19.6 Minebench reuse assessment and implementation boundary

**Reviewed source, 27 September 2026:** the repository's `master` explorer and supporting collision files, not merely the README or an unmerged large-world PR. Live branch URLs in the sources are not dependency pins; record the actual selected commit/hash before adapting code. This review inspected source, not a browser-run performance or mobile test.

`components/voxel/VoxelExplorer.tsx` uses three.js `PointerLockControls` for a first-person camera. It supplies keyboard movement, faster movement, jumping, a free-flight/noclip toggle, pause/resume, gravity and subdivided movement updates. The reviewed component has no third-person avatar rig or touch movement controls. Its imports and fetch paths also connect it to Next.js and hosted build endpoints. [S41]

`lib/voxel/explorerCollision.ts` represents occupied voxel cells in bitsets, checks an axis-aligned player volume, and resolves movement one axis at a time. The reviewed code restricts the collision grid to 512 cells on each axis. It is not a generic LDraw mesh/capsule controller. Its movement-vector normalisation and asynchronous/cancellable preprocessing patterns are useful references, while its geometry assumptions require replacement. [S42]

**Reuse decision:** adapt the small useful interaction ideas, and optionally selected MIT-licensed functions after review; do not fork the whole application as the editor foundation. Keep the new renderer, parts library and document model. Remove Next router dependencies, remote build-fetching, block atlas materials, voxel water/lava semantics and benchmark/account/database services from any adapted module. Replace the collision adapter with the brick-world implementation in 19.1.2, and implement the touch/third-person requirements locally.

Suggested extraction boundaries are `ExploreInputController`, `FirstPersonCameraController`, `FollowCameraController`, `CharacterControllerAdapter`, `BrickCharacterRig` and `PlaySession`. Pass the existing project scene/collision snapshot into them; none should fetch a build or know about the original app's backend. Keep optional atmosphere/view-bob effects separate so clean photo capture can disable them.

The code licence is MIT and requires retaining its copyright/permission notices with copied substantial portions. The bundled Faithful texture pack has a separate licence including a non-monetisation restriction; do not import it or its generated atlas as though it were covered by MIT. The brick editor does not need those textures. Audit every copied asset independently. [S40, S44]

The full Minebench architecture includes Next.js/API and remote storage/database/worker services. Those are not necessary for this local-first explorer and must not become static-site dependencies. Its separation of canonical build data from derived render assets is a useful architectural reference, already consistent with this specification. [S45]

## 20. Additional features worth designing for

### 20.1 Inventory extensions and real-part feasibility

**BrickLink Wanted List XML is already P0**, specified in sections 6.4–6.8; this section must not be interpreted as deferring it. The shared BOM service also exposes JSON reports in P0. CSV views, parts-on-hand management, shortages, spare-part presets, inventory-constrained fills and additional marketplace/XML profiles are later extensions.

Keep a visual model, an exact catalogue mapping, a historically known part/colour combination and current availability as separate states. Export mappings and user choices must not silently alter the design. Online prices or seller search require an optional, separately reviewed integration; no marketplace credentials belong in a static bundle. Basic XML generation has no dependence on those services.

### 20.2 Architectural editing aids

Include section planes, exploded views, measurements, floor-height guides, room labels and named camera sets. These are authoring aids, not automatically exported physical geometry. Allow “show current floor with the floors below ghosted” and “hide roof in this camera profile” without changing construction order or permanently deleting parts.

A dimension display can show studs/LDU and an approximate physical scale, while Play retains its separately declared gameplay scale. Parameterised stairs, railings, walls, doors and roof generators should produce ordinary editable part occurrences, with a retained recipe and explicit regeneration preview.

### 20.3 Revision review and diagnostics

Offer named checkpoints and an occurrence-level comparison: added, removed, moved, recoloured and reassigned-layer parts. Render differences as temporary overlays and export structured change reports for agents. A model-health panel should distinguish missing definitions, unsupported rendering features, uncertain connectivity, collisions, disconnected assemblies and instruction-plan omissions.

Add camera collections such as exterior/front, exterior/rear, ground-floor/interior and upper-floor/interior. A single agent command should render a collection against one revision and produce images plus a shared manifest. This is especially useful for evaluating architectural consistency from several directions.

### 20.4 Library and offline management

Expose installed library versions, connector coverage and offline packs. Upgrading a project's library lock must be an explicit operation that previews changes in resolved definitions, dimensions, materials and thumbnails. Retain the previous lock so a regression can be reversed.

A future collaboration adapter can exchange the same validated commands, but multi-user authority, conflict resolution, authentication and shared assets require a separate protocol and usually a service. Do not market the static, local-only implementation as collaborative merely because two people can exchange files.

## 21. Security, privacy and resource limits

### 21.1 Trust boundaries

Treat imported LDraw, native projects, ZIP archives, URL fragments, image assets, metadata and commands as untrusted input. Names and descriptions are text, not HTML. Reject executable content and do not interpret imported strings as scripts, event handlers, CSS or arbitrary browser URLs.

The virtual filesystem resolves references only within embedded project assets and explicitly allowed library namespaces. Normalise separators and dot segments without permitting traversal outside a namespace. Reject duplicate conflicting archive paths and prevent ZIP path traversal. A reference resembling an external URL must not trigger a fetch by default. Remote import is a separate, user-confirmed HTTPS action with CORS requirements and a clear origin display.

Self-host runtime dependencies, fonts, templates and default environment assets. Do not add third-party telemetry, session replay or model uploads by default. Redact model text, URL payloads and private metadata from routine logs. A share-link checksum detects corruption; it is not authentication, encryption or author verification.

### 21.2 Initial policy limits

The following are proposed application defaults, not browser guarantees. Make profiles configurable and allow deliberate desktop overrides only after showing expected resource impact. Apply limits before and during work, not only after parsing or decompression has completed.

| Resource | Desktop default proposal | Mobile default proposal | Required handling |
|---|---:|---:|---|
| Imported source/archive bytes | 25 MiB | 10 MiB | Reject before expensive processing |
| Total decompressed project bytes | 100 MiB | 40 MiB | Enforce incrementally; abort on overflow |
| Embedded files | 10,000 | 5,000 | Count before allocating all file objects |
| Reference nesting depth | 64 | 64 | Also detect graph cycles explicitly |
| Expanded placed occurrences | 100,000 | 25,000 | Count expansion, not just unique definitions |
| Generated additions per command | 10,000 | 2,000 | Preview count and require budget |
| Output image pixels | 16 megapixels | 4 megapixels | Also respect device texture/renderbuffer limits |
| Individual decoded texture | 16 megapixels | 4 megapixels | Verify decoded dimensions and supported type |
| Generated share URL | 8 KiB soft / 32 KiB hard | Same | Offer file export above the hard cap |

Separately track geometry vertices/triangles, total decoded texture memory, unique definitions, worker message sizes and outstanding asynchronous jobs. A tiny source can expand into a large repeated graph, and a small compressed image can decode into substantial memory. Once compiled, do not assume a file-size cap also enforces a GPU-memory cap.

Every expensive job must support cancellation, progress and a terminal limit/error state. Release temporary buffers, object URLs, render targets and geometry references after cancellation. Quality degradation must be visible rather than silently omitting parts.

### 21.3 Browser controls

Use a restrictive Content Security Policy and a controlled set of same-origin workers and assets. Precompile trusted JSON validators rather than enabling arbitrary runtime code generation. Evaluate any WebAssembly policy requirement separately; do not broadly enable unsafe script evaluation just to make a dependency work. [S34]

Do not auto-run commands from URL data, grant clipboard access on import, or expose unrestricted filesystem/network actions through the automation API. Keep automation opt-in, capability-described and local to the page. An external agent-protocol wrapper must require its own access controls rather than assuming the browser API provides authentication.

Handle WebGL context loss and restoration. Preserve the authoritative document, report the interruption, rebuild derived renderer resources and retry only idempotent operations. A graphics failure must not erase unsaved edits or prevent a native backup.

## 22. Acceptance tests and performance budgets

### 22.1 Required fixture suite

Commit small hand-auditable fixtures, including a simple wall, a room with an interior camera, repeated nested submodels, embedded custom geometry, decorated/fixed-colour parts, transparent parts, BFC reflections, conditional lines, texture metadata with fallback, missing references, cycles, malformed input and an opening door/wheeled assembly.

Give every fixture a provenance/licence record. Do not use arbitrary downloaded proprietary models as redistributable tests. Pin library files used by visual fixtures. Store expected semantic manifests separately from image snapshots.

Include inventory fixtures for repeated submodels, inherited/fixed colour, printed/left/right variants, an embedded official-name override, a composite with known decomposition, custom geometry, partial scope, an excluded transient avatar and XML-special characters. Include exploration fixtures with a narrow doorway, hollow window frame, slopes, stairs, a low ceiling, an exterior wall, two spawn points and the supported rigid-joint character.

### 22.2 Functional acceptance matrix

| ID | Test | Pass condition |
|---|---|---|
| LD-01 | Import nested MPD with two instances of one submodel | Both render in correct world positions; definitions are shared without losing occurrence identity |
| LD-02 | Recolour or move one nested occurrence | Default operation makes the relevant path unique; the other instance remains unchanged; undo restores original sharing and IDs |
| LD-03 | Current colours, edge colours and fixed decoration | Effective inherited colours resolve correctly; repainting does not recolour fixed decoration unintentionally |
| LD-04 | Type 2/5 lines, BFC and mirrored transforms | Reference rendering and optimised rendering agree within declared tolerance for tested camera views |
| LD-05 | Texture/custom-geometry import | Source/assets survive native round-trip; unsupported rendering is warned and strict capture fails, rather than silently claiming accuracy |
| LD-06 | Missing references, cycles and filename edge cases | Structured diagnostics; no infinite recursion, disappearing source records, unintended network fetch or silent filename truncation |
| LD-07 | LDraw semantic round-trip | Flattened reference identity/effective colour/world placement match; coordinate discrepancy is at most 0.0001 LDU for approved fixtures |
| LD-08 | Native round-trip | Layers, IDs, source records, custom assets, cameras, plans, library lock and rigs survive; no renderer cache is required |
| LD-09 | Per-layer export | Each file resolves independently; recombining files preserves original world positions and expected counts; hidden parts export under the chosen policy |
| ED-01 | Locked-layer explicit mutation | Whole command fails atomically; no target changes and no partial history entry is added |
| ED-02 | Batch recolour/fill/replace | One gesture is one undo entry; IDs and metadata restore correctly; fixed colours and unsupported targets are handled explicitly |
| ED-03 | Selection after render-batch repacking | Picking and query IDs still identify the correct authored occurrence |
| ED-04 | Filled region with obstacles and gaps | No invented fractional bricks; excluded/hidden obstacle policy is respected; preview matches committed output |
| ED-05 | Select visible versus through | Occluded parts are excluded in visible-only mode and included when geometrically eligible in through mode |
| UI-01 | Narrow touch interface | At 360 CSS pixels, core tools, layer controls, properties and export are reachable without desktop-only modifiers or hover |
| UI-02 | Touch camera/placement separation | Pinch and two-finger pan never accidentally place bricks or commit an unfinished drag |
| SV-01 | Quota failure and interrupted save | In-memory project remains intact; previous recoverable snapshot survives; native backup is offered; UI does not say saved |
| SV-02 | Concurrent tabs and migrations | A stale writer cannot silently overwrite newer work; supported migrations preserve state and unknown schemas are not destructively rewritten |
| RN-01 | Exact interior camera | Export uses specified position/target/up/near plane without automatic reframing; dimensions and alpha match the request |
| RN-02 | Headless readiness and snapshot | Capture waits for the requested revision and resources, returns its manifest, and cannot mix concurrent document revisions |
| RN-03 | Graphics failure | A structured WebGL error is returned; non-rendering validation/export remains usable where applicable; context restoration retains the document |
| BL-01 | Wanted List format | No declaration/BOM/DOCTYPE; correct root/item structure; each lot has the four required fields; no generic `QTY` or store-only tags |
| BL-02 | Occurrences and physical boundaries | Repeated submodels multiply correctly; primitives/decorations are not lots; unreferenced MPD files do not count; composites are emitted or decomposed exactly once |
| BL-03 | Scope and inherited colours | All/visible/layer/selection/submodel scopes match preview; hidden parts count by default; inherited colours resolve before aggregation |
| BL-04 | Mapping failures and overrides | Unmapped/ambiguous/custom entries block complete export; explicit partial export has a report; local files cannot steal official mappings; substitutions are never silent |
| BL-05 | Serialization and replay | Text escapes safely; invalid characters/quantities fail; identical inputs yield identical XML; stale revision, mapping or visibility snapshots are rejected |
| BL-06 | Offline/headless/mobile | Starter palette exports without network, account or WebGL; UI/API/CLI rows agree; phone copy/download is usable; transient avatar never changes counts |
| BL-07 | Destination smoke test | A human-authorised test uploads representative generated XML through BrickLink's intended Wanted List flow and checks item/colour/quantity without purchasing; evidence records the date and snapshot; no claim of live validation until performed |
| IN-01 | Layer/imported instruction plan | Every intended leaf occurrence is introduced exactly once; repeated subassemblies and inventory counts remain correct |
| IN-02 | Stalled assembly heuristic | Output is marked draft/incomplete with specific blockers; no fabricated claim of buildability |
| PL-01 | Interior exploration | Character can traverse tested rooms, doors and stairs; world collider construction does not fill a house's interior |
| PL-02 | Play isolation and pose application | Walking/animation does not change the authored revision; explicit pose application is revision-checked and undoable |
| PL-03 | Kinematic wheel and hinge (P2) | Parts rotate about declared local pivots; wheel rotation uses declared radius/distance; fixed-tick capture records simulation state |
| PL-04 | First-person body visibility | No body/hands required or drawn; actor collision and eye height still work; capture can run without pointer lock |
| PL-05 | Third-person rigid joints | Only configured joints move, around correct pivots; no invented elbow/knee bends; gait stops against a wall; switching camera preserves player pose |
| PL-06 | Camera obstruction and movement | Follow camera avoids room walls/ceilings; walk handles slopes, steps, thin obstacles and ceiling impacts; free-flight-to-walk transition cannot trap the actor inside solids |
| PL-07 | Touch and lost input | Move/look/jump work together on a phone; blur/pause/cancel clears input; no stuck movement, unintended editor actions or mandatory keyboard |
| PL-08 | Fixed-tick replay and cleanup | Agent input plus tick counts gives the expected path/pose in a pinned environment; exit restores editor view; repeated entry does not leak listeners or grow GPU allocations continually |
| SEC-01 | Malicious archive/fragment/reference | Resource limits, traversal checks and decompression cancellation work; importing cannot execute code or silently overwrite a project |

Passing a simple brick fixture does not establish whole-library compatibility. Publish a machine-readable test/coverage manifest identifying exactly which source features, connector directives and dynamic collider classes are supported.

### 22.3 Proposed performance objectives

These numbers are acceptance targets to validate, not measured performance claims. During M0, nominate and record an actual desktop and phone reference device, browser version, quality profile and library fixture. Measure cold load, warm load, interaction and export separately.

| Scenario | Initial objective |
|---|---|
| Desktop, 5,000 common opaque placed parts, 1080p balanced view | Aim for 60 frames/second during orbit after caches are warm |
| Phone, 1,000 common placed parts, fast profile | Aim for 30 frames/second during navigation; adapt render resolution if needed |
| Desktop batch change of 1,000 already-loaded occurrences | Main-thread command plus scene-update CPU time below 100 ms at the 95th percentile |
| Repeated user input during background import/fill/planning | Avoid recurring main-thread tasks longer than 50 ms; expose a cancellable busy state where unavoidable |
| Initial application JavaScript | Aim below 1.5 MiB compressed, excluding the on-demand part library and lazy-loaded Play/PDF modules |
| Idle editor with no animation | Render only when invalidated; no unnecessary permanent 60 Hz render loop |
| Stress fixture beyond the reference workload | Degrade quality with a warning or reject by budget; never silently drop authored parts |

Record triangles, draw calls, geometries, material variants, decoded textures, CPU/GPU timing where available, startup bytes and peak memory. Different parts have different geometric cost; raw brick count alone is not a sufficient performance metric. Transparent, textured and mechanism-heavy scenes need separate profiles.

Do not make launch claims based on an empty scene or a repeated two-triangle placeholder. Optimisation work must preserve the reference fixture's material, picking, line and round-trip tests.

## 23. Implementation milestones and dependency order

### M0 — Risk reduction and contracts

Pin three.js and the source library/colour configuration; audit the intended distributed licences. Build a small conformance harness proving correct orientation, colour inheritance, fixed-colour repainting, nested submodels, type 5 lines, image capture and a headless WebGL environment. Confirm texture gaps explicitly. Select reference devices and record baseline performance.

Deliver architecture decisions, versioned project/command/API schemas, fixture provenance, catalogue build manifest, initial dependency lockfile and a compatibility report. Decide which connector metadata subset is included and how its licence obligations are met. A feature claimed by the spec but unsupported by the prototype remains a tracked task, not an assumed loader capability.

P0 inventory risk gate: choose the authorised mapping-pack source, establish physical part boundaries/decomposition policy, add BrickLink profile/diagnostic schemas and pin verified starter mappings. XML serialization and BOM traversal must be testable without graphics. First-person/third-person contracts are designed now, but do not block the editor prototype.

### M1 — Small end-to-end editor

Implement the source AST, namespace-aware resolver, canonical document, stable occurrence IDs, command dispatcher, renderer adapter and native/LDraw export. Load a small audited starter palette; place, move, recolour and delete parts; undo a command; save/recover a small project; export a PNG through the browser automation API. Implement the BOM service and a minimal BrickLink Wanted List export for the verified starter palette, including mapping diagnostics and the inventory API/CLI.

Exit gate: a blank project can become a 200-part build using both UI and commands; native reload and LDraw round-trip preserve it; the same 200-part fixture produces expected BrickLink lots offline; a local Playwright run renders a fixed camera without manual interaction. This milestone proves the architecture before a large catalogue or elaborate interface is added.

### M2 — Editing and touch workflows

Add layers/locks/solo, occurrence-safe submodel edits, selection modes, clipboard, workplanes, bulk recolour, arrays and deterministic fills. Implement responsive panels, touch tools, templates, inspector controls and keyboard accessibility. Add inventory preview/resolution UI and whole-build/layer/selection export scopes; prove copy-on-write keeps inventory overrides attached to the intended occurrences.

Exit gate: the ED/UI tests pass, locked scope is enforced through both UI and API, batch operations are atomic, and a touch-only user can complete the main create/save/export workflow.

### M3 — Reliable interoperable release

Finish tested P0 import/export coverage, missing-reference diagnostics, source preservation, per-layer exports, recovery/multi-tab controls, basic instruction playback/layer steps, photo presets/interior cameras and command/query/job APIs. Complete P0 BrickLink mapping/quantity/partial-report semantics and per-layer XML archives; run BL acceptance tests and document the authorised destination smoke-test result. Add measured instancing/picking optimisations, context-loss handling, security limits and the static deployment configuration.

Exit gate: all applicable P0 acceptance tests pass; exact supported/unsupported features are documented; the CLI validates, edits, renders and exports; source fixtures and performance reports are committed. This is the first supported editor release, not yet a claim of complete construction planning or mechanical simulation.

### M4 — Connectivity, publishing and basic exploration (P1)

Expand connector/directive support, collision diagnostics, texture rendering and catalogue offline packs. Add instruction editing, assisted planning, camera suggestions, PNG/PDF publishing and bounded share links. Expand the already-shipped inventory mapping coverage; do not postpone BrickLink export to this milestone. In an independent exploration workstream, add Play snapshots, walking/free flight, first-person body-free rendering, third-person rigid-joint animation, touch controls, safe spawns/colliders and fixed-tick agent control. Exploration does not depend on completion of PDF layouts or automatic instruction planning.

Exit gate: interoperability features have independent fixtures, unsupported connections remain visible, instruction drafts expose uncertainty, and licence/provenance output covers every added asset pack. The exploration workstream independently passes PL-01/02/04–08; it can ship separately from publishing when those gates pass.

### M5 — Kinematic mechanisms (P2)

Extend the existing explorer with authored door hinges, axles, driveable kinematic chassis/wheels and compatible moving collision proxies. Do not rebuild the basic character or delay it for these features. Extend play automation with validated mechanism inputs and posed-export controls.

Exit gate: PL-03 and all applicable earlier PL tests pass; play never mutates the design implicitly; a sample room/door/chassis project persists and restores its rig configuration.

### M6 — Optional advanced work

Only after the prior gates, consider dynamic vehicles/suspension, more advanced assembly search, path-traced stills, inventory-constrained optimisation, auto-rig proposals and a separately scoped collaboration service. Each needs its own compatibility, performance and licence gate. None should block the static P0 editor.

## 24. Coding-agent kickoff brief

The following can accompany this document as the initial implementation instruction:

> Implement M0 and M1 of this specification first. Produce a TypeScript/Vite/React static application with a renderer-independent LDraw document, source-preserving import/export, stable occurrence identity, a versioned command dispatcher and a three.js rendering adapter. Use a pinned audited starter library; do not vendor Web Lic or assume BrickStep code is reusable. Keep UI, persistence, rendering and physics out of the domain core.
>
> Demonstrate place, move, recolour, delete and undo for a 200-part build. Save a small project to localStorage with recoverable failure handling. Export native project, LDraw, **BrickLink Wanted List XML** and PNG. Use the S39 Wanted List field profile, an audited offline starter mapping pack and occurrence-aware BOM traversal; never assume LDraw and BrickLink identifiers/colours match. Deliver the inventory preview, structured failure/partial reports and a non-graphics CLI test. Expose the documented browser API and provide a Playwright example that loads a fixture, edits it and exports a fixed interior-camera image without manual interaction.
>
> Commit schemas, fixtures, unit/integration/browser tests, a capability report and source/licence notices. Prove nested-submodel identity, current/fixed-colour handling and coordinate conversion before optimisation. Use independent scene objects as the correctness baseline; optimise only behind the renderer adapter. Do not replace real parts with placeholder cuboids without marking that as a diagnostic-only approximation.
>
> Run the available tests and report exact results, unresolved failures and unsupported capabilities. Implement no backend, automatic uploads, API secrets, universal physics claims or unsupported texture claims. Do not start basic exploration or advanced instruction layout until the P0 editor gates pass. Then implement exploration before or independently of vehicle physics: first person has no visible body, and third person uses only declared rigid-part joints. Minebench is a selective MIT code/reference source, not a voxel-data or backend dependency; exclude its separately licensed textures. Collaboration remains out of scope.

The initial repository must include a README with install/build/test commands, local headless-render instructions, deployment-base-path configuration, library-pack preparation and an explicit supported-feature matrix. Include an architectural decision record for every deviation from this specification.

## 25. Research sources

Original sources were reviewed on 26 September 2026. S35 and S39–S46, plus the relevant character-controller reference, were reviewed for the 27 September 2026 amendment. Unchanged sections retain the original source review rather than implying a fresh audit of every dependency. URLs using `master` or another live branch are research references, not reproducible dependency pins: the implementation must record actual selected commits, release identifiers and hashes. Licence observations are a starting point for compliance review, not a legal opinion. Third-party availability and terms may change.

| ID | Primary source and relevance |
|---|---|
| S01 | LDraw file-format specification: coordinates, reference matrices, line types and filenames. `https://www.ldraw.org/article/218.html` |
| S02 | LDraw multi-part document and embedded image specification. `https://www.ldraw.org/article/47.html` |
| S03 | LDraw BFC specification. `https://www.ldraw.org/article/415.html` |
| S04 | LDraw colour definition specification. `https://www.ldraw.org/article/299.html` |
| S05 | LDraw texture mapping specification. `https://www.ldraw.org/texmap-spec.html` |
| S06 | LDraw official library header specification, including permitted licence statements. `https://www.ldraw.org/article/398.html` |
| S07 | LDraw legal information; inspect alongside actual file headers rather than assuming one licence for every file. `https://www.ldraw.org/docs-main/licenses/legal-info.html` |
| S08 | three.js LDrawLoader API documentation: scene loading, materials and file mapping. `https://threejs.org/docs/pages/LDrawLoader.html` |
| S09 | Reviewed three.js LDrawLoader implementation. `https://raw.githubusercontent.com/mrdoob/three.js/master/examples/jsm/loaders/LDrawLoader.js` |
| S10 | three.js LDraw example source, including optional merging and orientation conversion. `https://raw.githubusercontent.com/mrdoob/three.js/master/examples/webgl_loader_ldraw.html` |
| S11 | three.js MIT licence. `https://raw.githubusercontent.com/mrdoob/three.js/master/LICENSE` |
| S12 | buildinginstructions.js repository and its declared Unlicense/public-domain status. `https://github.com/LasseD/buildinginstructions.js` |
| S13 | Web Lic repository README, including its explicit non-open-source restriction. `https://github.com/remig/web_lic` |
| S14 | BrickStep service and legal pages; no reusable implementation licence established by the reviewed material. `https://brickstep.net/` and `https://brickstep.net/legal.html` |
| S15 | LDraw.org model viewer and its upload/processing notice. `https://library.ldraw.org/model-viewer` |
| S16 | LDCad shadow library: snapping/mirroring metadata and CC BY-SA 4.0 licence. `https://github.com/RolandMelkert/LDCadShadowLibrary` |
| S17 | LDCad custom meta documentation, including connectivity directives. `https://www.melkert.net/LDCad/tech/meta` |
| S18 | three-mesh-bvh maintainer repository. `https://github.com/gkjohnson/three-mesh-bvh` |
| S19 | Rapier JavaScript character-controller documentation. `https://rapier.rs/docs/user_guides/javascript/character_controller/` |
| S20 | Rapier JavaScript joint and motor documentation. `https://rapier.rs/docs/user_guides/javascript/joints/` |
| S21 | Rapier JavaScript collider documentation. `https://rapier.rs/docs/user_guides/javascript/colliders/` |
| S22 | Rapier engine repository and licence; follow its current binding/package guidance. `https://github.com/dimforge/rapier` |
| S23 | MDN storage quotas and eviction criteria. `https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria` |
| S24 | MDN Web Storage API, including synchronous behaviour. `https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API` |
| S25 | MDN URI fragment semantics. `https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment` |
| S26 | three.js WebGLRenderer API and WebGL2 baseline. `https://threejs.org/docs/pages/WebGLRenderer.html` |
| S27 | Playwright browser-context evaluation and value transfer. `https://playwright.dev/docs/evaluating` |
| S28 | three.js InstancedMesh API. `https://threejs.org/docs/pages/InstancedMesh.html` |
| S29 | pdf-lib maintainer repository. `https://github.com/Hopding/pdf-lib` |
| S30 | fflate maintainer repository. `https://github.com/101arrowz/fflate` |
| S31 | UK government overview distinguishing intellectual-property protections. `https://www.gov.uk/intellectual-property-an-overview` |
| S32 | three-gpu-pathtracer maintainer repository; optional future adapter, not a promised drop-in. `https://github.com/gkjohnson/three-gpu-pathtracer` |
| S33 | LDraw AVATAR specification: category representatives, not character rigs. `https://www.ldraw.org/avatar-spec.html` |
| S34 | Ajv standalone validation-code documentation. `https://ajv.js.org/standalone.html` |
| S35 | BrickLink Wanted List mass upload guidance and example. Page is marked under construction and its required-field table differs from S39; follow the stricter S39 profile. `https://www.bricklink.com/help.asp?helpID=207` |
| S36 | Example official library part page with a concrete per-file licence declaration. `https://library.ldraw.org/parts/50715` |
| S37 | LDraw documentation index. `https://www.ldraw.org/docs-main.html` |
| S38 | Curated resource discovery list; inclusion is not a licence grant. `https://github.com/ad-si/awesome-lego` |
| S39 | User-specified BrickLink XML specification; use the Wanted List supported-tag table, not the general inventory example. `https://www.bricklink.com/help.asp?helpID=2567` |
| S40 | Minebench MIT code licence. `https://github.com/Ammaar-Alam/minebench/blob/master/LICENSE` |
| S41 | Minebench first-person explorer implementation, controls, frame loop and hosted integration. `https://raw.githubusercontent.com/Ammaar-Alam/minebench/master/components/voxel/VoxelExplorer.tsx` |
| S42 | Minebench voxel collision and movement helper implementation. `https://raw.githubusercontent.com/Ammaar-Alam/minebench/master/lib/voxel/explorerCollision.ts` |
| S43 | three.js PointerLockControls documentation. `https://threejs.org/docs/pages/PointerLockControls.html` |
| S44 | Faithful texture-pack licence bundled with Minebench; separate from the code's MIT licence. `https://raw.githubusercontent.com/Ammaar-Alam/minebench/master/assets/texture-pack/LICENSE.txt` |
| S45 | Minebench architecture: source/render separation and full-app backend dependencies. `https://raw.githubusercontent.com/Ammaar-Alam/minebench/master/docs/architecture.md` |
| S46 | BrickLink colour guide; target catalogue colour identifiers. `https://www.bricklink.com/catalogColors.asp` |

