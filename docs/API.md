# Automation API 1.0

The actual contract is the exported TypeScript API in `src/automation/api.ts` plus the generated versioned JSON Schemas. Enable it only with `?automation=1`. Coordinates are LDraw/LDU. Occurrence IDs are JSON-encoded reference-node paths, so treat them as opaque strings obtained from queries. UI selection is not an implicit API scope.

- `capabilities()` returns the machine-readable support report.
- `ready({minRevision?, strict?})` awaits staged renderer updates and refuses missing/unsupported resources in strict mode.
- `project.import({format:'ldraw', text, name?, strict?})`, `{format:'native', bytes:number[]}` or `{format:'template', template}` stages a new project and returns its revision. Sample builds (the chooser's cards): `'blank'|'cafe'|'windmill'|'lighthouse'|'jeep'|'house'|'castle'|'car'`; test fixtures, kept for automation and the test suites but not offered in the chooser: `'room'|'wall'|'200'|'explore'|'mechanisms'|'seated-vehicle'|'door-room'|'physics'` (the schema's description lists both). Samples that use parts outside the curated catalogue (café, windmill, lighthouse, jeep) load the complete library's index first. No user file is uploaded. A concurrent edit rejects the import.
- `project.export({format:'native'|'ldraw', scope?})` returns `{name,mimeType,bytes:Uint8Array}`. Native exports preserve the whole project. LDraw scope uses the inventory scope shape.
- `query({ref?,colorCode?,layerId?,occurrenceIds?})` returns revision, semantic occurrences and diagnostics. Unimplemented spatial/connectivity queries are not advertised.
- `dispatch({schemaVersion:1,commandId,expectedRevision,type,payload,dryRun?})` atomically changes the document. `dryRun` validates and returns counts without mutation/history/ledger entry.
- `transaction({commandId,expectedRevision,commands,dryRun?})` commits multiple commands as one undo entry. Each child command must use the same expected revision. A history command must stand alone.
- `inventory.preview(request)` and `inventory.export(request)` use the documented spec shapes. The extension `acceptUnknownColors:true` explicitly acknowledges unknown part/colour combination coverage. It does not lift `INVALID_PART_COLOR` (a reviewed item BrickLink does not list in that colour and no source records). Each preview row carries `colorExistence`: `verified` (BrickLink), `derived` (Rebrickable), `not-recorded`, `unknown` or `not-produced`. Revision, mapping hash and project hash are validated at export. `acceptDerivedMappings:true` accepts derived and reviewed mappings for the whole list. Each preview also has `resolution`: one row per part and colour in scope (`part` key `namespace:ref`, `tier` = `verified`/`reviewed`/`derived`/`ambiguous`/`unmapped`/`custom`, `mapping` = the tier or `user`/`override`/`excluded`, `itemId`, `suggestedItemId`, `candidates` for ambiguous parts, `colorExistence`, `colorAccepted`, `status` = `ready`/`accepted`/`needs-attention`/`excluded`, `problems` = blocking diagnostic codes), needing attention first. New diagnostic codes: `AMBIGUOUS_MAPPING` (details `{candidates}`), `REVIEWED_MAPPING`, `EXCLUDED_BY_USER` (warning, one per part).
- `library.updateStatus()` returns `{needed, pinned, current, retired, changesKnown, textures, changed:[{ref, occurrences}], changedOccurrences, partsOutsideCatalogue}` (`textures` is the texture pack lock bound to the current release) for a project pinned to another complete library release. `library.update({expectedRevision, checkpoint?})` saves a checkpoint when asked ("Before parts library update (<release>)") and dispatches the undoable `library.update` command (payload `{expected:{releaseId, manifestSha256}}`, refused with `REVISION_CONFLICT` if the pin changed), recording the previous lock in `metadata.previousLocks`.
- `camera.set(spec)` sets an exact transient perspective/orthographic camera; it never fits the build automatically.
- `render.image(request)` returns `{blob,manifest}`. PNG only, explicit visibility, 16 megapixels maximum plus GPU limits. It rejects concurrent document revisions and overlapping captures. `backdrop` (`blank|grass|street|beach|night|studio`) draws that backdrop instead of the project's; the manifest records `backdrop: {name, drawn}` (`drawn` is false for Blank and over a transparent background).
- `render.backdrop.get()` returns `{name, grid, stats}`; `render.backdrop.set({name?, grid?})` saves `name` in the project as one undoable `scene.set` command and toggles the editor grid overlay (a view preference). `stats` reports the drawn objects, texture sizes, texture bytes and build time. See [rendering](RENDERING.md#backdrops).
- `jobs.list()`, `jobs.status(id)`, `jobs.cancel(id)`, `jobs.wait(id)` expose parsing jobs. `project.import()` waits for its job by default; another caller can list/cancel it while pending. Fill UI workers have direct cancellation controls.

Supported command types and payloads are in `schemas/command.v1.json`. Families: project rename; scene settings (`scene.set` with `backdrop` and a one-line `playHint`, `null` clears); part add/remove/transform/recolour/replace/duplicate; layer add/update/rename/reorder/remove/assign; group create; camera bookmark; inventory override (`inventory.override` with `{occurrenceId, mapping}` for one occurrence, or `{part, decision}` for every occurrence of a part: `decision` = `{itemId?, origin?, checked?, exclude?, acceptedColors?, acknowledged:true}` or `null`); complete-library update (`library.update`); layer instruction generation; undo/redo. No arbitrary script evaluation, external file operations or network fetch commands exist.

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

`play.enter({realtime:false})` freezes the current rendered revision; manual fixed ticks are the API default. The UI uses realtime mode with bounded catch-up. Public positions are in LDraw LDU (negative Y up); `positionAnchor` distinguishes standing feet from the virtual avatar root while seated. Angles are radians. The declared capsule (`profile`, id `ldraw-minifig-v1`: 104 LDU tall, radius 12, eye 86, the true scale of the LDraw minifig figure) is never rescaled to a doorway; it steps up risers of up to 24 LDU (`profile.stepHeight`). The Rapier engine is pinned and lazy-loaded.

`snapshot().avatar` is presentation state computed on fixed ticks: `state` (`idle`, `walk`, `run`, `jump`, `fall`, `fly`, `seated`), `heading` (body yaw, independent of the look `yaw`; see below), `phase` (advances 2π per `profile.strideLength`, 85 LDU, travelled), `swing` (0–1), `headYaw` (±50°; seated ±0.7 rad), `headPitch` (seated: −0.35 to 0, forward only), `bob` (LDU, flight only), the four limb angles (radians, positive swings forward) and `leftWrist`/`rightWrist` (each hand's turn about its grip axis). `play.figure()` describes the drawn figure (its LDraw pack and parts, mesh and triangle counts, height and joint rotations; diagnostics, not a stable contract). `play.frameTrace(clear?)` returns the camera and the interpolated figure root and pose drawn in recent realtime frames, with wall and simulated times (diagnostics for smoothness tests, not a stable contract).

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

Inputs are bounded to [-1,1], ticks to0–3600 per request. Input objects replace held movement actions; omitted axes/buttons reset. `yaw`/`pitch` are absolute look angles.

**Look and heading.** `yaw`/`pitch` (input and snapshot) are always the player's look, which is the camera's: in first person the view direction, in third person the orbit camera's bearing (the camera sits behind the look direction from the figure). The figure's body yaw is `avatar.heading`; the two are separate values in both modes. Movement is always relative to the look: `moveZ` 1 goes along the look yaw (away from a third-person camera), −1 back towards it, `moveX` 1 to its right. First person keeps the body with the view (travel more than 100° from the look walks backward facing forward; the body turns once the head passes 50°). Third person is an orbit camera: the look yaw orbits 360° independently of the figure, the figure turns smoothly to face its movement (so walking towards the camera turns it round) and keeps its heading when standing still, and the head follows the look within 50° then eases back to straight ahead as the camera swings round to the front. While seated, `occupancy.localLookYaw` is the look relative to the vehicle and the chase camera orbits the vehicle the same way. These are unchanged fields; no new snapshot field was needed. `play.pause(true)` clears held input. A safe teleport or fly-to-walk transition validates/recoveries the capsule; unresolved geometry can fall back to explicitly labelled fly mode. Render captures pause realtime advancement and include the Play snapshot in their manifest. Simulation does not edit document transforms or inventory. Project changes cancel the session; exit restores the prior editor camera and visibility.

**Camera zoom.** The mouse wheel, trackpad pinch (ctrl+wheel) and a two-finger pinch on the view zoom the third-person camera: the follow distance (`cameraSettings.followDistance`) scales by about 16% per wheel notch between 40 and 400 LDU, and the camera eases to it over a few ticks (geometry behind the figure still pulls it in at once). Zooming in past 40 LDU switches to first person; zooming out of first person returns to third person at 40 LDU, pulling back from the figure. This follows the familiar game convention and keeps the wheel useful in both modes. The wheel is taken over only above the view or while the mouse is captured, so the page never scrolls or zooms instead. The chosen distance is kept for the browser tab (`sessionStorage`) and used by later entries unless `cameraSettings.followDistance` is given. Automation: `play.zoomCamera(factor)` (below 1 zooms in) returns the snapshot.

The session-only ground is an infinite plane at Y=0 and can be disabled with `ground:false`. Collision triangles preserve model openings and ignore editor hidden-layer state. Unsupported/missing geometry and the million-triangle budget are reported. Reproducibility is tested in the pinned engine environment, not promised across every platform. Authored mechanism sessions and pose application use the separate mechanisms API below.

## Clipboard, arrays and mechanisms

`clipboard.copy({occurrenceIds})` returns a bounded version-one fragment with referenced custom definitions and applicable metadata. `clipboard.cut({occurrenceIds,expectedRevision,commandId})` removes only after the fragment validates. Paste uses the undoable `clipboard.paste` command with `fragment`, optional `delta`, target `layerId` and `maxAdditions`. Opaque directives and metadata that cannot be remapped are explicitly refused. Fragments retain full hierarchy and physical part boundaries.

`parts.array` accepts `kind:"linear"`, `delta`, `count` (new copies), or `kind:"circular"`, `center`, unit `axis`, `angleDegrees` per copy and `count`. It supports command dry runs and the same scope/lock/budget checks. Results include `addedIds`, `removedIds` and `copyMappings`.

The `mechanisms` API is separate from the walking actor. Create a rig through `rigs.upsert`, or import the `mechanisms` test fixture (the `windmill`, `lighthouse`, `castle`, `jeep` and `car` samples carry authored rigs too). Rigid group frames, occurrence memberships, rest transforms, joint anchors/axes, limits and vehicle wheel radii are explicit data. Public hinge angles are degrees, prismatic offsets are LDU, and the simulation scale is 0.02 metres/LDU.

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

`instructions.publish({planId,format,width,height})` returns an artifact for `pdf`, `png-zip` or `html-zip`. Its registered job supports cancellation. The captured steps must cover every occurrence exactly once; this is coverage validation, not proof of physical buildability. `camera.fit()` frames the full build before capture. `render.quality.get()` and `render.quality.set(name, controls)` manage viewport quality; image requests may supply `qualityControls` independently. `render.look.get()` and `render.look.set(name, controls)` choose the shading look — `standard` (default), `realistic` or `photo` — independently of quality; image requests take an optional `look`/`lookControls` and default to `standard`, and the capture manifest records the resolved `look`. `photo` path-traces stills (`lookControls.pathSamples`, `depthOfField`, `backdrop`); `render.look.photo()` and a photo capture's manifest `photo` report whether the path tracer or the raster fallback drew it, and why. `render.collection` accepts `lookControls` too. See [rendering looks](RENDERING.md).

### Layer organization

`layers.duplicate` accepts `{ layerId, includeHidden?, name?, maxAdditions? }` and returns fresh layer/occurrence IDs in the command result. Duplication reads a locked source without changing it and creates an unlocked copy; unsupported opaque metadata and motion rigs are rejected. `layers.folder` sets `{ layerId, parentFolderId: string | null }`. `folders.add`, `folders.rename`, `folders.move`, and `folders.remove` manage organizational folders; removal promotes children/members without deleting build geometry. See the generated command schema for exact fields and bounds. Folder membership persists in native projects.

Canvas box/lasso selection is transient UI state, using visible-surface or through-selection modes and explicit replace/add/remove/toggle operations. Transform handles likewise keep previews out of the document and use existing revision-checked transform transactions only on commit. These tools do not add unversioned automation mutation paths.

`project.exportProfile(request)` runs a cancellable, revision-checked export job. Requests use `schemas/exportProfileRequest.v1.json`; profiles are `standard`, `portable`, `layers`, and `native`. Scoped source metadata requires explicit acknowledgement where applicable. Official geometry ZIPs require extraction and recipient colour configuration. See the CLI export-profile examples for corresponding offline usage.

Play entry accepts optional `rigId` for one authored kinematic rig, or `rigIds` for up to 32 distinct rigs; the two fields are mutually exclusive. `play.setMechanismJoint(jointId, value, rigId?)` and `play.setMechanismVehicleInput({throttle,steering}, rigId?)` control transient poses. Omit the target only when exactly one rig is active. Snapshots expose `mechanisms` keyed by rig ID; the legacy `mechanism` field is present only for a single rig. All rigs share the fixed-tick actor collision world. Combined limits are 128 rigid groups and 200,000 moving triangles, with no overlapping occurrence memberships. Every active rig must be included in the Play layer profile. Consult the generated API schema for structured payloads. Reports include per-rig blocked-motion diagnostics. Instruction editing uses the `instructions.*` commands declared in `schemas/command.v1.json`, including step notes and camera metadata.

Play also exposes `configureCamera(partial)`, `chooseSpawn({position,yaw,pitch})` and `useSpawn()`. Camera fields and bounds are declared in `schemas/api.v1.json`; snapshots report `cameraSettings`, `cameraSafety` and the chosen `spawn`. Spawn selection validates exact supported positions without moving the actor. Using a spawn revalidates current colliders, enters Walk and preserves the current pause state. Camera and spawn settings are session-only; keyboard bindings are a browser UI preference.

`play.enter({worldProfile:{excludedLayerIds},ground})` explicitly controls layer exclusion and temporary ground. Excluded layers are absent from Play rendering, captures and collision; ordinary editor visibility does not remove them. All layers of a selected rig must remain included. The resolved profile is recorded in Play snapshots.

`instructions.publish({planId,format,dimPrevious:true})` dims cumulative previous parts while preserving current additions. `render.image` accepts `instructionNewIds` for the same temporary treatment. The UI preview/publish checkbox shares this option; the project and ordinary captures retain original materials.

`models.editShared` supports `operation:"rotate"` with a unit `axis`, `degrees` and `pivot` in definition-local LDraw coordinates. It requires `confirmShared:true`, validates every affected occurrence and refuses motion-rig rest changes. The transform is composed onto existing affine geometry without discarding scale, shear or reflection.

`fill.preview(request)` runs a bounded worker preview; `fill.startPreview(request)` returns a cancellable job ID for `jobs.wait/cancel`. Requests use either legacy `ref` (columns/rows count parts) or `allowedRefs` (columns/rows count 20-LDU cells). Allowed sets accept quarter-turn `orientations` and a row-major boolean `mask`; all parts must have the same body height. The origin is the first cell centre. Results include frozen revision/layer, covered/eligible counts, gaps and proposed parts. Commit with one revision-checked `parts.add` command. The greedy algorithm is deterministic, not globally optimal; conservative obstacle bounds and unknown shapes may prevent placement.

Rig creation UI supports fixed/moving hinge groups and a chassis with up to eight wheel groups. Draft previews preserve authoring rest poses and require a fresh revision before `rigs.upsert`. Replacing/removing rigs validates both old and new members against locks, visibility and optional active-layer scope. Compound-rig editing, arbitrary-frame UI and physical vehicle dynamics remain unfinished; supported edit/removal workflows are detailed below.

### Structured queries

`query` retains the original colour/ref/layer/occurrence-ID filters and adds `scope` (all, visible, layers, explicit selection, or a submodel occurrence), `selection:true` for the current editor selection, and `connectivity:"unverified"|"verified"`, which filters by verified stud-connector coverage. Every result reports `connectivity.status` (`verified`, `partial` or `unverified`), `coveredIds` and `missingConnectorCoverageIds`. CLI callers use an explicit selection scope instead of browser selection state.

Every result includes matched/project occurrence counts, counts by reference, unresolved reference names with affected occurrence IDs, and IDs whose affine transforms cannot represent physical rigid bodies. Reflections/shears remain valid authored geometry; that diagnostic does not say they are unrenderable.

`spatial:true` adds conservative world-space source bounds. `bounds:{min,max,mode:"intersects"|"contained"}` filters against those boxes. `intersectingCandidates:true` lists pairs of occurrence IDs with overlapping boxes; these are broad-phase candidates, not proven collisions, contacts or connections. Unknown boxes remain explicitly listed and set `complete:false`, including when a spatial filter cannot include them. Bounds include studs and line endpoints; conditional-line control points are excluded. Rotated/transformed source boxes may overestimate occupied space. Project-local overrides never borrow an official part's box.

Spatial and diagnostic queries operate without WebGL or network access. Official boxes and dependency metadata cover the entire pinned source closure, including primitives rather than only the six purchasing identities. They are generated using `npm run library:bounds`; `npm run library:validate` independently recalculates them and checks the manifest lock. Intersection queries cap work at 2,000,000 comparisons and 10,000 pairs; dependency diagnostics have a separate 2,000,000-work bound. Repeated unresolved-reference reports and intersection pairs each have an additional conservative 8 MiB encoded-text budget; unresolved reports also cap at 2,000,000 reference items. Project overrides inside an official dependency subtree make custom-part bounds unknown rather than undersized. Missing-reference traversal follows the renderer’s merged custom namespace; direct official leaves retain the pinned namespace. A limit failure asks callers to narrow the query rather than silently truncating candidates.

```sh
npm run cli -- query --input model.mpd --request query.json --output result.json
```

The optional request file uses the same query schema. For example, `{"spatial":true,"scope":{"kind":"visible"}}`. The CLI refuses to overwrite its model or request file.

Rig authoring now supports guarded loading, editing and removal of representable two-group/single-joint rigs or pure planar vehicle rigs. Fixed, revolute, prismatic and spherical joint definitions can be authored. Revolute values are degrees; prismatic values are LDU. Fixed and spherical joints have no scalar controls; spherical preview stays at rest. Motor data persists but does not imply simulated actuation. Imported frames, IDs, custom axes and absent limits are preserved. Unsupported compound topologies receive an explicit editing diagnostic; removal remains guarded and undoable.

Loaded rig definitions are compared with their reconstructed drafts before editing is enabled. Valid imported rigs whose tolerated axis, anchor or rest-transform discrepancies would be normalized are refused with an actionable diagnostic; ordinary floating-point roundoff and group ordering are allowed. This prevents a rename from silently rewriting mechanics data.

Occurrence IDs use canonical JSON arrays of 1–64 nonempty node IDs, each at most 1,024 Unicode code points. Their separate encoded limit is 393,409 characters; ordinary node, reference and layer IDs remain limited to 1,024 code points. The published schemas mark these fields and occurrence-keyed dictionaries with the `occurrence-id` format, which the bundled validators enforce. Selection/submodel scopes match path prefixes using a trie; an empty path is invalid.

Commands (including the entire transaction), clipboard requests, query, inventory, export-profile, fill, render and Play API requests are preflighted before schema validation or serialization: at most 25 MiB encoded JSON UTF-8, 1,000,000 values and 128 container levels. Shared objects are charged each time; cycles and accessors are rejected. Undefined optional values are conservatively charged as null. Split or narrow oversized explicit selections. Clipboard fragment preflight uses its separate 16 MiB budget. Native project import retains its separate archive/decompressed limits and is not subject to this generic request budget. CLI command files are size-checked before reading. These limits do not establish a global bound on every expanded project/report or compiler operation.

Play image capture holds a temporary mutation lock. Joint/vehicle input, stepping, teleporting and session replacement are rejected with `CAPTURE_BUSY` before changing simulation state. Read-only snapshots remain available. An explicit pause received during capture takes precedence over automatic resume; document replacement invalidates the old session and its pending restoration.

## Animated Play joints

`play.setJointTarget({rigId?,jointId,target,speed})` queues transient revolute or prismatic travel. Omit `rigId` only when exactly one rig is active. Revolute targets are degrees and speeds are degrees/second; prismatic targets are LDU and speeds are LDU/second. Targets must respect authored limits. Speeds range from 0.001 to 3,600 degrees/second or 0.001 to 10,000 LDU/second. These are kinematic travel rates, not motor torque or dynamic actuation.

Each 60 Hz tick advances the actual mechanism through the existing swept actor-clearance checks. Completion lands exactly on the requested target. A blocked tick retains the last accepted pose and stops that target until a new request. Each mechanism report includes `jointTargets`, keyed by joint ID, with `current`, `target`, `speed`, `status` (`moving`, `blocked`, `complete`), `units`, `speedUnits` and an optional `blockedReason`.

The contextual E/touch action uses 90 degrees/second or 40 LDU/second. Activating it while moving reverses the intended destination, including before the midpoint. A blocked contextual action retries the same destination after the explorer moves clear. Existing `play.setMechanismJoint` remains an immediate swept placement and cancels a queued target only for that joint.

Pausing stops realtime advancement and retains targets for resume. Explicit `stepTicks` still advances a paused session for automation; capture's mutation lock rejects stepping and new targets. Exiting or replacing the session discards targets. The authored project, rest pose and exported source remain unchanged until an explicit apply-pose command.

## Authored driver seats

The `seated-vehicle` test fixture provides an original open-bench example, and the `jeep` sample a driver seat in a real-parts vehicle. A vehicle's optional `driverSeat` metadata specifies a pelvis anchor, access point, standing approach and 1–4 ordered standing exits in chassis-local LDU; its facing and exit yaw values use degrees. Native backups and vehicle edits preserve this data. Runtime occupancy is separate and is never stored as a source part or inventory item.

```js
await api.project.import({ format: "template", template: "seated-vehicle" });
await api.ready();
await api.play.enter({ rigId: "vehicle", position: [80, -0.3, -188] });
const seat = { rigId: "vehicle", seatId: "driver" };
const eligibility = await api.play.vehicleSeatEligibility(seat);
if (eligibility.eligible) {
  await api.play.enterVehicle(seat);
  await api.play.setInput({ moveZ: 1, moveX: 0.2 });
  await api.play.stepTicks(30);
  await api.play.setInput({});
  await api.play.exitVehicle();
}
```

`vehicleSeatEligibility` performs the complete current entry validation and returns `{eligible,rigId,seatId,reason?}`. Entry checks again, so a later world change may invalidate an earlier result. The per-frame contextual UI uses a cheaper reach/access hint and reports any final entry refusal. `exitVehicle({exitIndex?})` tries the explicit index when supplied, otherwise the authored order. A blocked exit stops input but retains occupancy; reposition and retry, or exit Play. Unsafe entry leaves the actor and vehicle unchanged.

While occupied, `positionAnchor` is `seated-avatar-root`, `avatar.state` is `seated`, and `occupancy` contains `rigId`, `seatId`, `profile`, `pelvisWorldLdu`, `avatarRootWorldLdu`, `effectiveEyeWorldLdu`, `localLookYaw` and `localLookPitch`. The last two are radians. Movement input controls the vehicle while look remains relative to it. The eye is fixed by the explicit seated profile; standing eye-height settings apply again after exit. Fly, teleport and spawn changes require leaving the seat first. Entry, exit and movement obey the capture mutation lock.

See [vehicle profile and boundaries](PLAY-VEHICLES.md) for collision policy and supported geometry. These seats use upright unarticulated kinematics and rigid straight-leg figures; they do not imply inferred seats, arbitrary cabin fit, general moving-platform support or dynamic suspension.

## Connectors

Verified stud/anti-stud connectors ([method and coverage](CONNECTORS.md)):

- `connectors.coverage()` returns the pack ID, part counts by verification rule, the supported/unsupported families and the verified part IDs.
- `connectors.part({ ref })` returns one catalogue part's verification status, rule or reasons, and its connectors in LDraw space.
- `connectors.snap({ part, position, angle? | basis?, up? })` snaps a proposed placement to the visible parts' verified connectors exactly as the Place tool does: `{ position, basis, contacts, targetIds }`, or `null` when nothing connects within one stud. The orientation is never changed; commit the result with `parts.add`.
- `connectors.connected({ occurrenceIds })` returns every occurrence joined to them by verified stud connections, plus the seeds without verified data (`uncoveredSeeds`).
- `connectors.groups()` returns connected groups (largest first), uncovered occurrence IDs and the number of stud contacts.
- `connectors.validatePlacement({ part, position, angle? | basis? })` tests a proposed placement against the editor's **Snap together** rule ([Connected building](CONNECTORS.md#connected-building-snap-together)) over the visible parts: `{ revision, ok, via, verified, reason, contacts, targetIds, message }`. `via` is `studs`, `hinge`, `ground`, `resting` (unverified contact), `unchecked` (part shape unknown) or `null`; `reason` is `floating`, `clash` or `null`.
- `connectors.validateMove({ transforms })` tests moving occurrences to the given world transforms (`{ [occurrenceId]: { position, basis } }`) as the Move and rotate handles do: the same fields plus `heldBefore`. A move is refused (`ok: false`) only when the parts held where they were and would float or clash where they go.

Snap together is a tool setting of the editor UI (on by default, remembered per device), not document data. Commands and transactions (`parts.add`, `parts.transform`, paste, arrays, fills) are never restricted by it; an automation client that wants the same behaviour calls the two queries above before dispatching. `capabilities().connectors.connectedBuilding` describes the rule and where the UI enforces it.

`health.check()` reports the Connections check from the same data.

## Motors, dynamic physics, automatic doors and posed export

See [Play physics](PLAY-PHYSICS.md) for behaviour and limits.

```js
await api.project.import({ format: "template", template: "physics" });
await api.ready();
const rigs = (await api.mechanisms.list()).map((rig) => rig.id);
await api.play.enter({
  rigIds: rigs,
  dynamicRigIds: rigs,
  position: [300, -0.3, 300],
});
await api.play.setMotor({ rigId: "spinner", jointId: "axle", enabled: false });
await api.play.setJointTarget({
  rigId: "door",
  jointId: "hinge",
  target: 90,
  speed: 90,
});
await api.play.setMechanismVehicleInput(
  { throttle: 1, steering: 0 },
  "vehicle",
);
const state = await api.play.stepTicks(120); // mechanisms[id].mode === "dynamic"
const posed = await api.play.exportPosedModel(); // { format: "ldraw-mpd", text, … }
await api.play.exit();
```

- `play.enter({dynamicRigIds})` names active rigs to simulate dynamically (at most 14). `autoDoors:false` turns automatic door hinges off; they are on by default.
- `play.setMotor({rigId?,jointId,enabled})` enables or stops an authored revolute or prismatic motor. Reports include `motors[jointId]` with `mode`, `target`, `enabled`, `status` (`running`, `holding`, `blocked`, `at-limit`, `stopped`), `units`, `targetUnits` and `simulation` (`kinematic-rate` or `dynamic-motor`).
- Dynamic mechanism reports use `mode:"dynamic"` and add `dynamics` with the engine, gravity (m/s²), per-group `bodies` (anchored, massKg, colliders, sleeping, linearVelocity in LDU/s, angularSpeed in degrees/s), per-wheel `wheels` (contact, suspensionLength in LDU, steering and rotation in degrees) and chassis `speed` (LDU/s). `setMechanismJoint` is refused for dynamic rigs; use `setJointTarget`, which drives the joint motor.
- `snapshot.autoDoors` lists derived door rigs (`rigId` `auto-door:N`, `jointId`, door and holder occurrence IDs, part, world `pivot`, `axis`, `leaf` and `swing`: `positive`, `negative`, `both` or `blocked`). It also lists `skipped` doors with a reason. Open a door with `play.interact()` near it, or with `setJointTarget`.
- `play.interact()` performs the contextual E/tap action (a door, joint, vehicle or, beside a track switch, the points) and returns the snapshot.
- `play.exportPosedModel()` and `mechanisms.exportPosedModel()` return a static posed MPD of all active mechanisms: `{format:"ldraw-mpd",text,sourceRevision,tick,rigIds,posedOccurrenceIds,warnings}`. The project is not edited.
- `mechanisms.list()` returns authored rigs with their joints, motors and optional `dynamics` settings.
- `dynamics.startDynamic: true` on any rig makes the Play card start with **Mechanism physics → Dynamic** chosen (the playground park sample sets it); automation still names `dynamicRigIds` explicitly.

Rig `dynamics` settings (optional, schema `motionRig`): `groups` keyed by group ID with `massKg` (0.001–100,000) and `anchored`; `friction` (0–4); `suspension` for vehicles, with `restLength` and `travel` in LDU (0.5–200), `stiffness` (1–500) and `damping` (0.05–50); and `engineForce` in simulation N. A dynamic vehicle chassis or wheel cannot be anchored.

## Trains

Play runs trains standing on official LDraw track (see [running trains](PLAY-TRAINS.md)); they are derived at entry and session-only. `play.enter({trains:false})` leaves them static.

- `play.setTrainThrottle({trainId?,throttle})`: −1..1 of full speed (480 LDU/s); negative runs backwards, 0 coasts to a stop. Omit `trainId` when one train runs.
- `play.stopTrain({trainId?})` stops a train at once.
- `play.setPoints({occurrenceId,route?})` sets a switch to `"straight"` or `"branch"`, or toggles it without `route`; refused while a train covers it.
- `play.rideTrain({trainId?})` puts the camera on a train (chase view in third person, the cab in first); `{trainId:null}` ends the ride. Walking input is ignored while riding.
- `snapshot().trains`: `trains[]` (`id` `train:N`, `name`, `cars[]` with `locomotive`, `parts` and `bogies`, `throttle`, `speed` LDU/s, `status` `stopped`/`running`/`end-of-track`/`blocked`/`waiting`, `reason`, `odometer` LDU, head `position` and `heading`, `pieces` on its route), `track` (`pieces`, `gaps` with distance and angle, `deadEnds`, `skipped`), `switches[]` (`occurrenceId`, `part`, `route`, `occupied`, `trailed`, `position`), `skipped` rolling stock with reasons, `tick` and `riding`.
- `connectors.orient({part,point,normal})` returns rail-end fits (`mode:"track"`) for a track part near the placed track; `connectors.validatePlacement` reports a track piece joined end to end as held by its rails (`via:"rails"`).

## Renderer budgets

- `render.budget()` returns the active resource profile, its renderer budget (part occurrences, raw occurrences, part/colour variants, unique geometry triangles, scene triangles, retained prototypes, reduced-quality threshold), the last rendered model's measured `usage`, whether interactive quality is reduced (`reducedQuality`), the last interactive frame (`lastFrame`: main-thread submission time, draw calls, triangles, lines) and what the batches draw (`batches`: instanced meshes/lines, merged batches, single objects and `occurrencesDrawn`) and the loading skeleton on screen (`skeleton`: boxes and those already replaced, or null). A model over any budget is refused with `LIMIT_EXCEEDED` (details name the resource, used amount, budget and profile); nothing is drawn, and the document, source exports and inventory stay available. See [resource limits](RESOURCE-LIMITS.md#renderer-budgets).
- `resources.setProfile(...)` re-assesses the current model against the new profile's renderer budget before its next `ready()`.
- `render.compileStats()` reports where compiled part geometry came from in this page: `workerCompiles` (compile workers), `diskHits` (the persistent geometry cache), `mainThread` (parts compiled on the main thread: no workers, or file-local colours), the worker pool size, the cache's hit/miss/write/eviction/corruption/error counts with its size and bound, and `lastLoad` (duration, variants, whether it was drawn progressively, how many tasks it was split into, `firstPartsMs` when the first compiled parts were drawn, `phases` (when planning, requests, compilation, progressive drawing, budget counting and placement ended), and `skeleton` when a loading skeleton was shown: its boxes, `shownMs`, how many boxes parts replaced while loading and whether it followed instruction steps; `?skeleton=0` turns the skeleton off). Diagnostics only; it never changes what is drawn.
- `play.collisionStats()` returns the static collider's triangle and vertex counts after compaction (diagnostics). Worlds whose rendered surface exceeds one million triangles collide with simplified official parts (studs and underside tubes omitted), reported in the Play warnings.

## Exploded views

- `render.explode.set({gap})` lifts floors (top-level submodels, else layers) apart by `gap` LDU each and returns `{groups, gap}`; `render.explode.get()` returns `{gap}`.
- `render.anatomy.set({on?, spread?, guides?, focus?, animate?})` takes the model apart by submodel (else layer, else touching cluster), each group sliding out along its clearest direction; it resolves once the animation has finished and returns `{on, progress, spread, guides, focus, basis, movers, planMs, groups[]}`. `spread` is 0.25–3 (1 just clears), `focus` a group `key` to isolate (others see-through) or `null`, `animate:false` jumps to the end. `render.anatomy.get()` returns the same status. Both are render-only: no command, revision or undo entry. See [Anatomy](ANATOMY.md).

## Build scripts and part search

Agents describe builds as **build scripts** (declarative JSON: walls, rooms, boxes, roofs, windows, doors, stairs, repeats, components) that compile deterministically to ordinary parts. Guide, op reference and system prompt: [AGENT-BUILDING.md](AGENT-BUILDING.md); schema: `schemas/buildScript.v1.json`.

- `buildScript.validate(script)` returns `{valid, issues:[{path, message}]}` (paths like `$.sections[0].ops[3].size`); nothing is compiled.
- `buildScript.compile({script, check?, includeLDraw?, targetParts?, leeway?})` compiles without touching the document and returns `{report, ldraw?}`. The report has `ok`, `stats` (parts, designs, lots, massing cells and parts, script bytes, parts per script KB, compile/check ms), `bounds` (studs with y in plates, and LDU), `sections`, `parts` (ref, name, colour, count), `heaviestOps`, `resolved` part searches, `check` (overlaps, off-grid, connected groups, health) and `problems` (`{severity, code, message, ops}` naming source ops such as `sections[1].ops[4].ops[0]` or `components.tower.ops[1]`). Codes: `overlap`, `colour-unavailable` (a placed part in a colour it is not made in; the message names colours it comes in), `over-budget` and `under-budget` (errors; the budget ones come first when the build is outside `targetParts` ± `leeway` percent, default 10, or over the script's `limits.maxParts`, and give the total and by how much, with the costliest top-level ops when over), `floating`, `off-grid`, `part-clash`, `opening-size`, `opening-height` (warnings), `colour-unchecked` and `part-moved` (info: an old part number built with the one it moved to). Invalid scripts and semantic errors throw `INVALID_INPUT` with the path; resource limits throw `LIMIT_EXCEEDED`.
- `buildScript.apply({script, dryRun?, expectedRevision?, check?, targetParts?, leeway?})` compiles and replaces the open project with the result (not when it is outside its part range: then `applied` is false) (like an import: undo does not bring the previous project back), returning `{applied, revision, report}`. `dryRun` only compiles. Each section becomes a submodel and a layer (a section's `layer` names it); components become submodels.
- `parts.search({query?, category?, size?:{w?,d?,h?}, colour?, availableInColour?, connectable?, scope?:'all'|'curated', limit?})` returns `{results}` ranked over the curated catalogue and the complete library: builder slang ("cheese slope", "headlight brick", "SNOT") first, then curated and commonly produced parts; printed, sticker, Duplo and obsolete variants last. Sizes are studs (either order) and plates (a brick is 3). Each result: `{id, name, size:{w,d,h}, category, curated, colours (count known), inColour?, verified (connectors; null if not loaded), bricklink?, thumbnail?, score, partial?}` — `thumbnail` is an image path, or a sprite sheet with a `#xywh=` fragment for complete-library parts; `partial` marks loose matches when no part matches every word.
