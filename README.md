# Brick Editor

A local-first, static React/TypeScript/three.js brick editor implementing the core editor, Play exploration, kinematic mechanisms and selected M2–M5 features from [spec.md](spec.md). **This is a working development build, not completion of the full P0–P3 roadmap.** Remaining acceptance gates are recorded in [docs/STATUS.md](docs/STATUS.md).

## Run

Requires Node **22.14 or later** and npm.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Models are parsed locally; there is no application backend, account, telemetry, automatic upload, marketplace credential, or external runtime asset host.

```sh
npm run build
npm run preview
npm test
npx playwright install --with-deps chromium
npm run test:browser
npm run library:validate
npm audit
```

The browser suite uses pinned Playwright Chromium with **SwiftShader software WebGL2**. It covers 1440×1000 desktop, the requested **1080×1800 touch viewport**, and 360×800. These are browser layout tests, not measurements from physical phones. `npm run test:performance` measures the running local app at port 4173; see [docs/reports](docs/reports) for environment-qualified results.

## Build and export

Choose a part and colour, tap the grid to position its translucent preview, then press **Place part**. Position fields use **LDraw units (LDU)**: 20 per stud, 8 per plate, negative Y upward. Numeric edits retain full affine precision. Grid placement makes no claim of connector compatibility.

Use Select to pick a part and Inspector to move, rotate, recolour, duplicate or delete it. Shift-click toggles a desktop selection. Inspector’s Selection tools also provide touch-accessible add/remove/toggle, matching part/colour/layer, and box/lasso with visible-surface or through-selection modes. Move/Rotate handles preview a gesture and commit one undo item; Escape or a second finger cancels. Navigate enables one-finger orbit; two-finger navigation never commits a placement. Undo/redo, numeric controls and exports are accessible without a keyboard. Shortcuts: `V` select, `B` place, `C` paint, `F` fit, Escape cancel, Delete remove, Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z redo, Ctrl/Cmd+D duplicate.

Layers have visibility and locks enforced by the command service. The UI edits only the active layer unless **Edit across layers** is enabled. Rectangular fill runs in a cancellable worker, reports conservative obstacle gaps, checks its revision at commit and creates one undo item. It does not claim optimal packing or verified connections.

Project offers blank, studio, wall and 200-part original templates. Replacing a nonempty build through the template UI downloads a native backup first. Clipboard tools in Inspector support copy/cut/paste, portable fragments and bounded linear/circular arrays. Layer controls support duplication, nested organisational folders, ghosting of other layers, reordering and explicit reassign-or-delete decisions. Ghosting changes the editing view only.

Open local `.ldr`, `.mpd`, `.dat` or `.brickproj` files from Project. Unsupported texture metadata is retained and reported; strict image capture refuses it. Missing parts remain in the document with diagnostic wireframe boxes and cannot enter a complete purchasing export.

Exports:

- **Native `.brickproj`**: checksummed ZIP with the complete versioned document, source records, custom assets and notices; authoritative state does not contain renderer caches.
- **LDraw `.mpd`**: source-aware model/embedded-definition export, preserving affine transforms, effective references, fixed colour, source ordering and unknown records. Scoped export through the API retains selected parent paths and embedded dependencies; unknown stateful metadata still requires explicit handling rather than silent loss.
- **BrickLink Wanted List XML**: offline preview, source traceability, all/visible/active-layer/selection scopes, condition, acknowledged overrides, explicit partial ZIP/report, complete per-layer ZIP, download and copy. Six starter part identities and five colours per identity are audited. Other combinations remain unknown until acknowledged. XML uses `ITEMTYPE`, `ITEMID`, `COLOR`, `MINQTY`, without an XML declaration. Seller availability is not queried; an authenticated destination smoke test has **not** been performed.
- **PNG + manifest**: offscreen render target, exact camera, explicit visibility, solid or transparent background, bounded pixel count, camera/revision/library hashes. No application screenshot or persistent drawing buffer is used.

Instructions supports root imported STEP/ROTSTEP boundaries (rotation metadata retained), layer-based plans/playback, sequential PNG/HTML archives and printable PDFs. Plans are organisational, not verified assembly instructions. Photo supports exact position/target, orthographic views, bookmarks, dimensions and transparency. **Play** provides first-person walking and free flight, third-person rigid-joint animation, touch movement/look/jump, safe respawn and fixed-tick automation. It freezes the build revision and restores the editor camera on exit. The original procedural figure is 72 LDU tall; models are never resized to fit it. A temporary ground plane belongs only to the session.

Autosave writes and verifies a new snapshot before changing the head pointer, retaining the prior snapshot on failure. Quota errors keep the current build in memory and prompt a native backup. Web Locks serialize same-origin writes where available; expected stored revisions reject stale writers. Saving in browser storage is not a permanent file backup.

Project also provides bounded self-contained share links, temporary import previews, opt-in offline downloads, and saved-project management. Native bundles include separately checksummed source and asset files.

The **Door & vehicle** template includes two original kinematic rigs. In Play, choose **All mechanisms**, approach a joint or vehicle, and press **E** or tap the nearby action. Doors open/close; vehicle control uses movement keys or the joystick while your explorer stays in place. Remote controls can select any active rig. The separate mechanism preview offers **Apply current pose** as an explicit undoable authoring operation. Seated entry, riding, vehicle/world dynamics and suspension remain unimplemented.

## Browser automation

Open `/?automation=1` to expose `window.brickEditor`; the API is absent by default. See [docs/API.md](docs/API.md), [CLI examples](docs/CLI.md), and the generated [schemas](schemas).

```js
const api = window.brickEditor;
const imported = await api.project.import({
  format: "template",
  template: "200",
});
await api.ready({ minRevision: imported.revision, strict: true });
const { occurrences, revision } = await api.query();
await api.dispatch({
  schemaVersion: 1,
  commandId: "paint-first-001",
  expectedRevision: revision,
  type: "parts.recolor",
  payload: { occurrenceIds: [occurrences[0].id], colorCode: "1" },
});
```

Core commands, inventory and file conversion also run in Node without DOM or GPU. Camera and selection are transient; bookmarks are authoring commands. Long import jobs expose status/cancellation; failed or cancelled imports leave the previous document intact.

## CLI

```sh
npm run cli -- validate --input fixtures/ldraw/nested.mpd
npm run cli -- inventory --input fixtures/ldraw/200-parts.mpd \
  --format bricklink-wanted-xml --scope all --condition any \
  --output wanted.xml --report wanted.report.json
npm run cli -- inventory --input build.brickproj \
  --layer base --per-layer --output layer-lists.zip
npm run cli -- export --input fixtures/ldraw/studio.mpd \
  --format native --output studio.brickproj
npm run cli -- apply --input studio.brickproj \
  --commands commands.json --output edited.brickproj
npm run cli -- instructions --input studio.brickproj \
  --max-per-step 10 --output steps.json
npm run cli -- render --input fixtures/ldraw/studio.mpd \
  --camera fixtures/renders/interior.camera.json \
  --width 1600 --height 1200 --output interior.png --report interior.render.json
```

Inventory never launches Chromium. A blocked complete export exits nonzero, writes diagnostics and leaves any previous XML file intact. `--allow-partial` must target a `.zip` when omissions exist; it never disguises an incomplete list as a complete XML file. Empty inventories yield a report without an upload file. `--accept-unknown-colors` acknowledges catalogue-combination uncertainty, not a verified match. Render launches a temporary localhost Vite server and pinned Chromium, then closes both. `scripts/capture-example.ts` is a complete fixed-interior-camera example.

## Static deployment

Published site: [Brick Editor](https://bricks.robertj.in/), hosted on Cloudflare Pages. See [deployment configuration](docs/DEPLOYMENT.md).

The [deployment workflow](.github/workflows/cloudflare.yml) validates pushes to `main`, then uploads the tested static assets with Wrangler when the repository Cloudflare token is configured. Remaining implementation work is tracked in [TODO.md](TODO.md) and [the detailed status report](docs/STATUS.md).

```sh
BASE_PATH=/brick-editor/ npm run build
```

Host `dist/` at that path on an ordinary static HTTPS host. No server-side router is required. Runtime asset paths and workers respect the Vite base. Use HTTPS (or localhost) for Web Crypto and clipboard. The HTML contains a restrictive same-origin CSP and precompiled Ajv validators; it does not permit JavaScript `unsafe-eval`; `wasm-unsafe-eval` permits the lazily loaded Rapier Play engine. Serve MIME types normally. Do not serve the source repository or a development server as production hosting.

## Library preparation and provenance

The shipped pack `public/libraries/starter-2026-09-27` contains six official parts and their exact dependency closure: 23 files including `LDConfig.ldr`. Every file has a source URL and SHA-256 in its manifest; all geometry files retain authors and actual licence headers. See [LDraw notices](public/notices/LDRAW.txt), [dependency notices](public/notices/DEPENDENCIES.txt) and [mapping provenance](src/catalog/mappings.json).

The ingestion script is maintainer-only, never runtime:

```sh
python3 scripts/fetch-library.py
npx tsx scripts/build-parts.ts
npm run library:validate
npm run notices
```

It is intentionally a starter-subset pipeline, not a whole-library importer. A new snapshot must use a new release directory/ID, followed by explicit lock updates and conformance tests; do not republish changed bytes under an existing release ID. `build-marketplace-mappings.ts` rebuilds the original curated correspondence pack with its own version/hash. No manufacturer model files, Web Lic source, BrickStep implementation, LDCad data or Minebench textures were copied.

Architecture decisions, source limitations and unimplemented milestones are detailed in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/STATUS.md](docs/STATUS.md). Machine-readable feature support is in [src/automation/capabilities.json](src/automation/capabilities.json).

The latest editing checkpoint includes world/face/numerical workplanes, oriented fills, submodel grouping and isolation, explicit shared recolour/local translation, configurable keyboard shortcuts, and export profiles. Portable geometry ZIPs preserve official part identity and require extraction plus recipient colour configuration. See [remaining work](TODO.md), [status](docs/STATUS.md), and [verification](docs/VERIFICATION.md).

Play can now explore authored moving doors and vehicles with conservative actor collision guards. Instruction plans support editable steps, notes and saved cameras. Graphics-loss tests cover retained edits, native backups and restored captures. See [Play acceptance coverage](docs/PLAY-ACCEPTANCE-AUDIT.md) for tested behavior and remaining gaps.
