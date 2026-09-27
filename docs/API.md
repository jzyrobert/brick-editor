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
