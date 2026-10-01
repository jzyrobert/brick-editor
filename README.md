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

The browser suite uses pinned Playwright Chromium with **SwiftShader software WebGL2**. It covers 1440×1000 desktop, the requested **1080×1800 touch viewport**, and 360×800. These are browser layout tests, not measurements from physical phones. Tests run in parallel; `npm run test:browser:quick` skips the slow path-traced and timing-budget tests for iteration (see [running the browser suite](docs/VERIFICATION.md#running-the-browser-suite)). `npm run test:performance` measures the running local app at port 4173; see [docs/reports](docs/reports) for environment-qualified results.

## Build and export

Choose a part and colour, tap the grid to position its translucent preview, then press **Place part**. Position fields use **LDraw units (LDU)**: 20 per stud, 8 per plate, negative Y upward. Numeric edits retain full affine precision. Tapping an existing part stacks the preview on, beside or under it; for parts with verified stud data it snaps so studs and anti-studs mate (see [connectors](docs/CONNECTORS.md)). Grid placement alone makes no claim of connector compatibility.

The editor opens in Navigate (one finger or left-drag orbits). Use Select to pick a part and Inspector to move, rotate, recolour, duplicate or delete it. Shift-click toggles a desktop selection. With a mouse, drag in Select to draw a box (L switches to a lasso, Shift adds, Alt removes; right-drag orbits); on touch, Inspector → Selection tools → Box or lasso select lets one finger draw while two fingers still move the view. Visible takes only the parts you can see; Through takes everything inside, front to back (by centre, or touching / fully inside); a live count and outline show what will be selected before you let go, and hidden or cut-away parts are never taken. Selection tools also offer add/remove/toggle, only-the-focused-floor and matching part/colour/layer. Move/Rotate handles preview a gesture and commit one undo item; Escape or a second finger cancels. Two-finger navigation never commits a placement. Undo/redo, numeric controls and exports are accessible without a keyboard. Shortcuts: `V` select, `L` box/lasso, `B` place, `C` paint, `F` fit, Escape cancel, Delete remove, Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z redo, Ctrl/Cmd+D duplicate.

Layers have visibility and locks enforced by the command service. The UI edits only the active layer unless **Edit across layers** is enabled. Rectangular fill runs in a cancellable worker, reports conservative obstacle gaps, checks its revision at commit and creates one undo item. It does not claim optimal packing or verified connections.

Project offers detailed sample builds as picture cards (see [templates](docs/TEMPLATES.md)): a **Corner café** with a staircase up to a roof terrace, a **Windmill farm** whose sails turn, a **Lighthouse** with a turning lamp on a rocky island, an **Off-road jeep** you can sit in and drive, a **House with garden**, a **Small castle**, a drivable **Roadster car** and a **Playground park** whose crates, barrels, swing, see-saw and roundabout move under dynamic physics, plus a blank canvas. Each opens on a fitting backdrop: **Camera views → Look → Backdrop** switches between Blank, Meadow, a toy Street map, Beach, Night city and Studio, saved with the build and shown in the editor, Play and captures (see [rendering](docs/RENDERING.md#backdrops)). The empty-canvas welcome card opens the café. The older technical starts (studio, exploration room, door room, mechanisms, physics, wall, 200 parts) remain automation-only test fixtures. Replacing a build that has changes (with a template, a file, a shared model or another saved project) first asks whether to save it to this device's project list, discard it or cancel; nothing is downloaded automatically. Clipboard tools in Inspector support copy/cut/paste, portable fragments and bounded linear/circular arrays. Layer controls support duplication, nested organisational folders, ghosting of other layers, reordering and explicit reassign-or-delete decisions. Ghosting changes the editing view only.

Open local `.ldr`, `.mpd`, `.dat` or `.brickproj` files from Project. Unsupported texture metadata is retained and reported; strict image capture refuses it. Missing parts remain in the document with diagnostic wireframe boxes and cannot enter a complete purchasing export.

Exports:

- **Native `.brickproj`**: checksummed ZIP with the complete versioned document, source records, custom assets and notices; authoritative state does not contain renderer caches.
- **LDraw `.mpd`**: source-aware model/embedded-definition export, preserving affine transforms, effective references, fixed colour, source ordering and unknown records. Scoped export through the API retains selected parent paths and embedded dependencies; unknown stateful metadata still requires explicit handling rather than silent loss.
- **BrickLink Wanted List XML**: offline preview, source traceability, all/visible/active-layer/selection scopes, condition, acknowledged overrides, explicit partial ZIP/report, complete per-layer ZIP, download and copy. Six starter part identities and five colours per identity are audited. Other combinations remain unknown until acknowledged. XML uses `ITEMTYPE`, `ITEMID`, `COLOR`, `MINQTY`, without an XML declaration. Seller availability is not queried; an authenticated destination smoke test has **not** been performed.
- **PNG + manifest**: offscreen render target, exact camera, explicit visibility, solid or transparent background, bounded pixel count, camera/revision/library hashes. No application screenshot or persistent drawing buffer is used.

**Build it step by step** follows any loaded model one step at a time: its own STEP lines (with sub-assembly callouts) or steps generated bottom up, with parts hopping into place from a tray beside the model, on phones and desktop; the **Parts list** counts every part × colour and exports CSV or Rebrickable CSV (see [docs/INSTRUCTIONS.md](docs/INSTRUCTIONS.md)). Instructions supports root imported STEP/ROTSTEP boundaries (rotation metadata retained), layer-based plans/playback, sequential PNG/HTML archives and printable PDFs. Plans are organisational, not verified assembly instructions. Photo supports exact position/target, orthographic views, bookmarks, dimensions and transparency. **Play** provides first-person walking and free flight, a third-person toy figure with Minecraft-style limb animation, desktop mouse look (click to capture, Esc to release), a game-style touch HUD (a stick that floats to your left thumb, drag anywhere to look, Jump/Run, and one pause menu for camera, fly, settings and Exit Play; phones held upright are asked to rotate, and Android also goes fullscreen in landscape), brick-height steps, safe respawn and fixed-tick automation. It freezes the build revision and restores the editor camera on exit. The original procedural figure is 72 LDU tall; models are never resized to fit it. A temporary ground plane belongs only to the session.

Autosave writes and verifies a new snapshot before changing the head pointer, retaining the prior snapshot on failure. Quota errors keep the current build in memory and prompt a native backup. Web Locks serialize same-origin writes where available; expected stored revisions reject stale writers. Saving in browser storage is not a permanent file backup.

Project also provides bounded self-contained share links, temporary import previews, opt-in offline downloads, and saved-project management. Native bundles include separately checksummed source and asset files.

The samples carry authored kinematic rigs: the windmill's sails and the lighthouse's lamp turn on motors, the castle's drawbridge is a hinge, and the jeep and roadster are vehicles (the jeep with a driver seat). In Play, choose **All mechanisms**, approach a joint or vehicle, and press **E** or tap the nearby action. Doors open/close; vehicle control uses movement keys or the joystick while your explorer stays in place, or from the jeep's driver seat. Remote controls can select any active rig. The separate mechanism preview offers **Apply current pose** as an explicit undoable authoring operation.

Official LDraw doors open without rigging: the house, café, farm and lighthouse samples use real 60596 frames with 60616a/60623 doors, and Play hinges each to its frame automatically (E or tap **Open door**). The **Playground park** sample starts Play in **Mechanism physics → Dynamic** (its rigs set `dynamics.startDynamic`); the `physics` test fixture (automation only) adds a loose crate and a motorised spinner. Under Dynamic, rigs become Rapier bodies with gravity, joint motors, suspension and pushing. Play never edits the build, and a static posed MPD is available from automation (`play.exportPosedModel`, CLI `--posed-output`). See [Play physics](docs/PLAY-PHYSICS.md). Riding and seated driving of dynamic vehicles remain unimplemented.

Trains standing on official LDraw track run in Play: press **Go**, set the speed, reverse, throw the points and ride along. The **Railway station** sample has an oval with a siding and a three-car train, and track pieces snap end to end in the editor. See [running trains](docs/PLAY-TRAINS.md).

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

## Building with agents

LLM agents can design large builds as compact [build scripts](docs/AGENT-BUILDING.md) (walls, rooms, roofs, windows, repeats, components) that compile to real parts with overlap and connectivity checks: `npm run cli -- build --script fixtures/build-scripts/santorini.json --output santorini.mpd --render views/santorini.png`. A ready-to-paste system prompt is in [prompts/build-agent.md](prompts/build-agent.md); `npm run cli -- parts search "cheese slope"` finds parts by description.

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

Inventory never launches Chromium. A blocked complete export exits nonzero, writes diagnostics and leaves any previous XML file intact. `--allow-partial` must target a `.zip` when omissions exist; it never disguises an incomplete list as a complete XML file. Empty inventories yield a report without an upload file. `--accept-unknown-colors` acknowledges catalogue-combination uncertainty, not a verified match; `--accept-derived-mappings` accepts BrickLink numbers taken from the LDraw part files' keywords (reported as acknowledged, not verified). Render launches a temporary localhost Vite server and pinned Chromium, then closes both. `scripts/capture-example.ts` is a complete fixed-interior-camera example.

## Static deployment

Published site: [Brick Editor](https://bricks.robertj.in/), hosted on Cloudflare Pages. See [deployment configuration](docs/DEPLOYMENT.md).

The [deployment workflow](.github/workflows/cloudflare.yml) validates pushes to `main`, then uploads the tested static assets with Wrangler when the repository Cloudflare token is configured. Remaining implementation work is tracked in [TODO.md](TODO.md) and [the detailed status report](docs/STATUS.md).

```sh
BASE_PATH=/brick-editor/ npm run build
```

Host `dist/` at that path on an ordinary static HTTPS host. No server-side router is required. Runtime asset paths and workers respect the Vite base. Use HTTPS (or localhost) for Web Crypto and clipboard. The HTML contains a restrictive same-origin CSP and precompiled Ajv validators; it does not permit JavaScript `unsafe-eval`; `wasm-unsafe-eval` permits the lazily loaded Rapier Play engine. Serve MIME types normally. Do not serve the source repository or a development server as production hosting.

## Library preparation and provenance

The shipped pack `public/libraries/catalogue-2026-09-29` contains the 224 curated official parts of the placeable catalogue ([scripts/catalog-parts.json](scripts/catalog-parts.json)) and their exact dependency closure: 650 files (1.74 MB) including `LDConfig.ldr`. Every file has a source URL and SHA-256 in its manifest; all geometry files retain authors and actual licence headers. The renderer loads the pack as one byte-exact `bundle.txt` (every listed file concatenated in manifest order, hash pinned by the manifest). The superseded `starter-2026-09-27` and `catalogue-2026-09-28` packs are kept unchanged as retired locks; every one of their files is byte-identical in the current pack, so projects pinned to it are re-pinned on load with the previous lock recorded in `metadata.previousLocks`. See [LDraw notices](public/notices/LDRAW.txt), [dependency notices](public/notices/DEPENDENCIES.txt) and [mapping provenance](src/catalog/mappings.json).

**Complete official library.** Every other official part resolves on demand from `public/libraries/ldraw-full-2026-09-28`, the whole official library (all 24,735 parts, 9,235 subparts and 2,835 primitives including `8/` and `48/`, plus `LDConfig.ldr`; textures and models are not included) built from the official `complete.zip` pinned by SHA-256 (`d2a69586…`, latest update 2026-08) in [scripts/full-library.json](scripts/full-library.json). Files are stored unmodified in 3,122 content-addressed gzip chunks (86 MB; 501 MB raw), with `index.json` (chunk table and, per part, its dependency-closure chunks and conservative bounds), `catalog.json` (searchable part list), `NOTICE.txt`, `CAreadme.txt` and `CAlicense4.txt`. A project's library lock records the pack (`library.full`); the manifest pins index, catalogue and colour file, and the index pins every chunk. When a model references a part outside the curated pack, the app fetches only the chunks of that part's closure in one batch, verifies each hash, and keeps them in Cache Storage for offline use; the CLI reads the same pack from disk. The pack is committed (generated output), so CI needs no network access; `npm run deploy:check` keeps the deployment within Cloudflare Pages limits. Connectors and occupancy for every official part are derived at build time into `public/libraries/connectors-ldraw-full-2026-09-28` (256 hash-pinned gzip shards, 9.3 MB), loaded with each part; derived marketplace mappings for 8,625 further parts come from the LDraw files' own BrickLink keywords (`src/catalog/mappings-derived.json`, pinned in the mapping pack, reported as derived, not verified). See [status](docs/STATUS.md#complete-official-library-2026-09-28) and [connectors](docs/CONNECTORS.md#complete-official-library).

The ingestion scripts are maintainer-only, never runtime:

```sh
python3 scripts/fetch-library.py catalogue-2026-09-29 2026-09-29 complete.zip  # official archive optional
python3 scripts/review-bricklink.py [date] [--recheck 3048b]  # evidence only (LDraw keywords are leads); item numbers are set by review
npx tsx scripts/build-parts.ts        # catalogue, bundle, mapping pack (with derived table), locks, notices
npm run library:bounds
npm run library:thumbnails            # renders public/thumbnails/<release>/*.webp
npm run library:part-thumbnails       # renders the complete library into sprite sheets (about 80 min; resumable)
npm run library:connectors            # curated connector pack
npm run library:full                  # complete pack from the pinned complete.zip (downloads to .cache/ldraw/)
npm run library:full-connectors       # connectors/occupancy for every official part (worker threads)
npm run library:validate              # curated and complete packs
npm run notices

# When LDraw publishes a new complete.zip:
npm run library:update -- complete.zip [--release-id ldraw-full-YYYY-MM-DD] [--keep-old]
```

The upstream server rate-limits single-file requests, so `fetch-library.py` can read missing files from a locally downloaded official `complete.zip` (its hash is recorded in the manifest). Catalogue dimensions, stud-grid phase and the studded flag are derived from real source bounds, with a few reviewed footprint overrides for parts whose handles or leaves widen the box. Thumbnails are 128 px WebP renderings (about 470 kB for all parts) produced by the app's own LDraw/three.js pipeline in headless Chromium: opaque white bodies that the UI tints to the held colour with a mask and multiply blend (a transparent colour shows them as glass). Every other placeable part of the complete library (23,343) is rendered by the same pipeline into 80 px cells of 365 content-addressed WebP sprite sheets with tint masks that leave prints untinted (`public/thumbnails/ldraw-full-2026-09-28`, 727 files, 24.9 MB, index hash locked in `src/catalog/part-thumbnails-lock.json` and checked by `library:validate`); the sheets are committed, never rendered in CI. It is a curated-subset pipeline, not a whole-library importer. A new snapshot must use a new release directory/ID, followed by explicit lock updates and conformance tests; do not republish changed bytes under an existing release ID. `build-marketplace-mappings.ts` (`npm run library:mappings`) rebuilds the correspondence pack with its own version/hash from reviewed BrickLink evidence ([scripts/bricklink-review.json](scripts/bricklink-review.json)) plus the derived keyword table. Rebrickable's CSV downloads (free with attribution) carry no BrickLink or LDraw identifiers, so they never map items; `npm run library:colors` uses a pinned, hashed snapshot of them for derived colour availability (which colours each part was really made in), next to BrickLink's verified known colours for curated parts. `library:update` pins a new archive under a new release ID, builds the complete and connector packs, retires the previous release with the files that changed, rebuilds mappings, validates and checks deployment limits (see [status](docs/STATUS.md)). No manufacturer model files, Web Lic source, BrickStep implementation, LDCad data or Minebench textures were copied.

Architecture decisions, source limitations and unimplemented milestones are detailed in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/STATUS.md](docs/STATUS.md). Machine-readable feature support is in [src/automation/capabilities.json](src/automation/capabilities.json).

The latest editing checkpoint includes world/face/numerical workplanes, oriented fills, submodel grouping and isolation, explicit shared recolour/local translation, configurable keyboard shortcuts, and export profiles. Portable geometry ZIPs preserve official part identity and require extraction plus recipient colour configuration. See [remaining work](TODO.md), [status](docs/STATUS.md), and [verification](docs/VERIFICATION.md).

Play can now explore authored moving doors and vehicles with conservative actor collision guards. Instruction plans support editable steps, notes and saved cameras. Graphics-loss tests cover retained edits, native backups and restored captures. See [Play acceptance coverage](docs/PLAY-ACCEPTANCE-AUDIT.md) for tested behavior and remaining gaps.
