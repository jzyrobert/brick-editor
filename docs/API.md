# Automation API 1.0

The actual contract is the exported TypeScript API in `src/automation/api.ts` plus the generated versioned JSON Schemas. Enable it only with `?automation=1`. Coordinates are LDraw/LDU. Occurrence IDs are JSON-encoded reference-node paths, so treat them as opaque strings obtained from queries. UI selection is not an implicit API scope.

- `capabilities()` returns the machine-readable support report.
- `ready({minRevision?, strict?})` awaits staged renderer updates and refuses missing/unsupported resources in strict mode.
- `project.import({format:'ldraw', text, name?, strict?})`, `{format:'native', bytes:number[]}` or `{format:'template', template:'blank'|'room'|'wall'|'200'}` stages a new project and returns its revision. No user file is uploaded. A concurrent edit rejects the import.
- `project.export({format:'native'|'ldraw', scope?})` returns `{name,mimeType,bytes:Uint8Array}`. Native exports preserve the whole project. LDraw scope uses the inventory scope shape.
- `query({ref?,colorCode?,layerId?,occurrenceIds?})` returns revision, semantic occurrences and diagnostics. Unimplemented spatial/connectivity queries are not advertised.
- `dispatch({schemaVersion:1,commandId,expectedRevision,type,payload,dryRun?})` atomically changes the document. `dryRun` validates and returns counts without mutation/history/ledger entry.
- `transaction({commandId,expectedRevision,commands,dryRun?})` commits multiple commands as one undo entry. Each child command must use the same expected revision. A history command must stand alone.
- `inventory.preview(request)` and `inventory.export(request)` use the documented spec shapes. The extension `acceptUnknownColors:true` explicitly acknowledges unknown part/colour combination coverage. Revision, mapping hash and project hash are validated at export.
- `camera.set(spec)` sets an exact transient perspective/orthographic camera; it never fits the build automatically.
- `render.image(request)` returns `{blob,manifest}`. PNG only, explicit visibility, 16 megapixels maximum plus GPU limits. It rejects concurrent document revisions and overlapping captures.
- `jobs.list()`, `jobs.status(id)`, `jobs.cancel(id)`, `jobs.wait(id)` expose parsing jobs. `project.import()` waits for its job by default; another caller can list/cancel it while pending. Fill UI workers have direct cancellation controls.

Supported command types and payloads are in `schemas/command.v1.json`. Families: project rename; part add/remove/transform/recolour/replace/duplicate; layer add/update/rename/reorder/remove/assign; group create; camera bookmark; inventory override; layer instruction generation; undo/redo. No arbitrary script evaluation, external file operations or network fetch commands exist.

A world-space translation:

```js
const q = await brickEditor.query({ colorCode: "4" });
await brickEditor.dispatch({
  schemaVersion: 1,
  commandId: crypto.randomUUID(),
  expectedRevision: q.revision,
  type: "parts.transform",
  payload: {
    occurrenceIds: q.occurrences.map((o) => o.id),
    delta: [0, -8, 0],
    space: "ldraw",
    includeHidden: true,
  },
});
```

Part additions supply a physical definition reference, colour identifier and transform:

```js
payload: {
  layerId: 'base', maxAdditions: 200,
  parts: [{
    ref: '3001.dat', colorCode: '4',
    transform: { position: [0, -24, 0], basis: [1,0,0, 0,1,0, 0,0,1] }
  }]
}
```

Layer removal requires `mode:'delete-contents'|'reassign'` and a different unlocked `destinationLayerId`. This avoids silent content deletion or default-layer reassignment. Group creation is an authoring convenience, not a new LDraw submodel.

`AppError` exposes a stable `code`, message and optional structured details. Important codes include `INVALID_INPUT`, `REVISION_CONFLICT`, `LAYER_LOCKED`, `REFERENCE_CYCLE`, `REFERENCE_MISSING`, `LIMIT_EXCEEDED`, `STORAGE_QUOTA`, `WEBGL_UNAVAILABLE`, `UNSUPPORTED_RENDER_FEATURE`, `INVENTORY_BLOCKED`, `STALE_INVENTORY_PREVIEW` and `CANCELLED`.

Snapshots and result objects are copies. Never infer persistent IDs from renderer indices or array positions. Command ID deduplication lasts only for the current session (500 entries), and replacement starts a fresh ledger. Obtain a fresh revision after undo/redo.

## Play exploration

`play.enter({realtime:false})` freezes the current rendered revision; manual fixed ticks are the API default. The UI uses realtime mode with bounded catch-up. Public positions are feet anchors in LDraw LDU (negative Y up); angles are radians. The declared 72 LDU capsule is never rescaled to a doorway. The Rapier engine is pinned and lazy-loaded.

```js
await api.play.enter({ position: [0, 0, 150], locomotion: "walk" });
await api.play.setInput({ moveZ: 1 });
const state = await api.play.stepTicks(60);
await api.play.setInput({});
await api.play.setCameraMode("third-person");
await api.play.setLocomotion("fly-noclip");
await api.play.teleport({ position: [0, -100, 0], policy: "free-flight" });
const report = await api.play.snapshot();
await api.play.exit();
```

Inputs are bounded to [-1,1], ticks to0–3600 per request. Input objects replace held movement actions; omitted axes/buttons reset. `yaw`/`pitch` are absolute look angles. `play.pause(true)` clears held input. A safe teleport or fly-to-walk transition validates/recoveries the capsule; unresolved geometry can fall back to explicitly labelled fly mode. Render captures pause realtime advancement and include the Play snapshot in their manifest. Simulation does not edit document transforms or inventory. Project changes cancel the session; exit restores the prior editor camera and visibility.

The session-only ground is an infinite plane at Y=0 and can be disabled with `ground:false`. Collision triangles preserve model openings and ignore editor hidden-layer state. Unsupported/missing geometry and the million-triangle budget are reported. Reproducibility is tested in the pinned engine environment, not promised across every platform. Authored mechanism sessions and pose application use the separate mechanisms API below.

## Clipboard, arrays and mechanisms

`clipboard.copy({occurrenceIds})` returns a bounded version-one fragment with referenced custom definitions and applicable metadata. `clipboard.cut({occurrenceIds,expectedRevision,commandId})` removes only after the fragment validates. Paste uses the undoable `clipboard.paste` command with `fragment`, optional `delta`, target `layerId` and `maxAdditions`. Opaque directives and metadata that cannot be remapped are explicitly refused. Fragments retain full hierarchy and physical part boundaries.

`parts.array` accepts `kind:"linear"`, `delta`, `count` (new copies), or `kind:"circular"`, `center`, unit `axis`, `angleDegrees` per copy and `count`. It supports command dry runs and the same scope/lock/budget checks. Results include `addedIds`, `removedIds` and `copyMappings`.

The `mechanisms` API is separate from the walking actor. Create a rig through `rigs.upsert`, or import the `mechanisms` template. Rigid group frames, occurrence memberships, rest transforms, joint anchors/axes, limits and vehicle wheel radii are explicit data. Public hinge angles are degrees, prismatic offsets are LDU, and the simulation scale is 0.02 metres/LDU.

```js
await api.project.import({ format: "template", template: "mechanisms" });
await api.mechanisms.enter("door");
await api.mechanisms.setJointPosition("hinge", 90);
const pose = await api.mechanisms.snapshot();
// Captures include the transient mechanism report; normal MPD export stays at rest.
await api.mechanisms.applyPose(); // explicit revision-checked, undoable edit
await api.mechanisms.exit();
```

`setVehicleInput({throttle,steering})` accepts values between -1 and 1. `stepTicks(n)` advances the kinematic vehicle at 60 Hz. Wheels rotate from distance/radius; steering uses a planar model. Dynamic suspension, forces and clutch strength are not simulated. Switching between mechanism previews and walking exits the previous session.

`instructions.publish({planId,format,width,height})` returns an artifact for `pdf`, `png-zip` or `html-zip`. Its registered job supports cancellation. The captured steps must cover every occurrence exactly once; this is coverage validation, not proof of physical buildability. `camera.fit()` frames the full build before capture. `render.quality.get()` and `render.quality.set(name, controls)` manage viewport quality; image requests may supply `qualityControls` independently.

### Layer organization

`layers.duplicate` accepts `{ layerId, includeHidden?, name?, maxAdditions? }` and returns fresh layer/occurrence IDs in the command result. Duplication reads a locked source without changing it and creates an unlocked copy; unsupported opaque metadata and motion rigs are rejected. `layers.folder` sets `{ layerId, parentFolderId: string | null }`. `folders.add`, `folders.rename`, `folders.move`, and `folders.remove` manage organizational folders; removal promotes children/members without deleting build geometry. See the generated command schema for exact fields and bounds. Folder membership persists in native projects.

Canvas box/lasso selection is transient UI state, using visible-surface or through-selection modes and explicit replace/add/remove/toggle operations. Transform handles likewise keep previews out of the document and use existing revision-checked transform transactions only on commit. These tools do not add unversioned automation mutation paths.

`project.exportProfile(request)` runs a cancellable, revision-checked export job. Requests use `schemas/exportProfileRequest.v1.json`; profiles are `standard`, `portable`, `layers`, and `native`. Scoped source metadata requires explicit acknowledgement where applicable. Official geometry ZIPs require extraction and recipient colour configuration. See the CLI export-profile examples for corresponding offline usage.

Play entry accepts optional `rigId` for an authored kinematic rig. `play.setMechanismJoint(jointId, value)` and `play.setMechanismVehicleInput({throttle,steering})` control its transient pose; consult the generated API schema for exact payloads. Snapshots include mechanism pose and blocked-motion diagnostics. Instruction editing uses the `instructions.*` commands declared in `schemas/command.v1.json`, including step notes and camera metadata.

Play also exposes `configureCamera(partial)`, `chooseSpawn({position,yaw,pitch})` and `useSpawn()`. Camera fields and bounds are declared in `schemas/api.v1.json`; snapshots report `cameraSettings`, `cameraSafety` and the chosen `spawn`. Spawn selection validates exact supported positions without moving the actor. Using a spawn revalidates current colliders, enters Walk and preserves the current pause state. Camera and spawn settings are session-only; keyboard bindings are a browser UI preference.

`play.enter({worldProfile:{excludedLayerIds},ground})` explicitly controls layer exclusion and temporary ground. Excluded layers are absent from Play rendering, captures and collision; ordinary editor visibility does not remove them. All layers of a selected rig must remain included. The resolved profile is recorded in Play snapshots.

`instructions.publish({planId,format,dimPrevious:true})` dims cumulative previous parts while preserving current additions. `render.image` accepts `instructionNewIds` for the same temporary treatment. The UI preview/publish checkbox shares this option; the project and ordinary captures retain original materials.

`models.editShared` supports `operation:"rotate"` with a unit `axis`, `degrees` and `pivot` in definition-local LDraw coordinates. It requires `confirmShared:true`, validates every affected occurrence and refuses motion-rig rest changes. The transform is composed onto existing affine geometry without discarding scale, shear or reflection.

`fill.preview(request)` runs a bounded worker preview; `fill.startPreview(request)` returns a cancellable job ID for `jobs.wait/cancel`. Requests use either legacy `ref` (columns/rows count parts) or `allowedRefs` (columns/rows count 20-LDU cells). Allowed sets accept quarter-turn `orientations` and a row-major boolean `mask`; all parts must have the same body height. The origin is the first cell centre. Results include frozen revision/layer, covered/eligible counts, gaps and proposed parts. Commit with one revision-checked `parts.add` command. The greedy algorithm is deterministic, not globally optimal; conservative obstacle bounds and unknown shapes may prevent placement.

Rig creation UI supports fixed/moving hinge groups and a chassis with up to eight wheel groups. Draft previews preserve authoring rest poses and require a fresh revision before `rigs.upsert`. Replacing/removing rigs validates both old and new members against locks, visibility and optional active-layer scope. Compound-rig editing, arbitrary-frame UI and physical vehicle dynamics remain unfinished; supported edit/removal workflows are detailed below.

### Structured queries

`query` retains the original colour/ref/layer/occurrence-ID filters and adds `scope` (all, visible, layers, explicit selection, or a submodel occurrence), `selection:true` for the current editor selection, and `connectivity:"unverified"|"verified"`. No verified connector pack is installed, so verified connectivity returns no matches; every returned occurrence is listed under missing connector coverage. CLI callers use an explicit selection scope instead of browser selection state.

Every result includes matched/project occurrence counts, counts by reference, unresolved reference names with affected occurrence IDs, and IDs whose affine transforms cannot represent physical rigid bodies. Reflections/shears remain valid authored geometry; that diagnostic does not say they are unrenderable.

`spatial:true` adds conservative world-space source bounds. `bounds:{min,max,mode:"intersects"|"contained"}` filters against those boxes. `intersectingCandidates:true` lists pairs of occurrence IDs with overlapping boxes; these are broad-phase candidates, not proven collisions, contacts or connections. Unknown boxes remain explicitly listed and set `complete:false`, including when a spatial filter cannot include them. Bounds include studs and line endpoints; conditional-line control points are excluded. Rotated/transformed source boxes may overestimate occupied space. Project-local overrides never borrow an official part's box.

Spatial and diagnostic queries operate without WebGL or network access. Official boxes and dependency metadata cover the entire pinned source closure, including primitives rather than only the six purchasing identities. They are generated using `npm run library:bounds`; `npm run library:validate` independently recalculates them and checks the manifest lock. Intersection queries cap work at 2,000,000 comparisons and 10,000 pairs; dependency diagnostics have a separate 2,000,000-work bound. Repeated unresolved-reference reports and intersection pairs each have an additional conservative 8 MiB encoded-text budget; unresolved reports also cap at 2,000,000 reference items. Project overrides inside an official dependency subtree make custom-part bounds unknown rather than undersized. Missing-reference traversal follows the renderer’s merged custom namespace; direct official leaves retain the pinned namespace. A limit failure asks callers to narrow the query rather than silently truncating candidates.

```sh
npm run cli -- query --input model.mpd --request query.json --output result.json
```

The optional request file uses the same query schema. For example, `{"spatial":true,"scope":{"kind":"visible"}}`. The CLI refuses to overwrite its model or request file.

Rig authoring now supports guarded loading, editing and removal of representable two-group/single-joint rigs or pure planar vehicle rigs. Fixed, revolute, prismatic and spherical joint definitions can be authored. Revolute values are degrees; prismatic values are LDU. Fixed and spherical joints have no scalar controls; spherical preview stays at rest. Motor data persists but does not imply simulated actuation. Imported frames, IDs, custom axes and absent limits are preserved. Unsupported compound topologies receive an explicit editing diagnostic; removal remains guarded and undoable.

Loaded rig definitions are compared with their reconstructed drafts before editing is enabled. Valid imported rigs whose tolerated axis, anchor or rest-transform discrepancies would be normalized are refused with an actionable diagnostic; ordinary floating-point roundoff and group ordering are allowed. This prevents a rename from silently rewriting mechanics data.

Known contract limit: occurrence-ID inputs currently inherit a 1,024-character schema bound even though sufficiently deep valid models can generate longer paths. Deep-path query/scope/command support remains tracked in TODO; no full nested-document conformance is claimed.
