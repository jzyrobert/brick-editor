# Local command-line rendering and publishing

Run commands from the repository with Node 22.14 or later after `npm ci` and `npx playwright install chromium`.

Inventory, validation, native/LDraw conversion, command application, and instruction JSON run directly in Node. PNG capture, Play capture, and PDF/PNG/HTML publication launch a temporary loopback server and local Chromium, then close both. No remote renderer or keyboard emulation is used.

Every official LDraw part resolves offline: the CLI registers the committed complete library pack (`public/libraries/ldraw-full-*`, verified against its lock) before any operation, and the local render server serves the same files. For example, `npm run cli -- health --input fixtures/ldraw/full-library.ldr` reports no missing definitions for its non-catalogue doors, dome and fences.

## Still renders and render looks

```sh
npm run cli -- render --input fixtures/ldraw/finishes.mpd --camera fixtures/renders/interior.camera.json --look realistic --output realistic.png
npm run cli -- render-collection --input build.brickproj --collection exterior/ --look photo --samples 32 --output exterior.zip
```

`render`, `render-collection` and `play` accept `--backdrop blank|grass|street|beach|night|studio` (default: the project's backdrop; the manifest records it) and `--look standard|realistic|photo` (default `standard`, the original look). `realistic` adds image-based lighting, tuned plastic/finish materials, ambient occlusion and soft shadows and hides outlines; `photo` path-traces each image in a studio (256 samples by default; `--samples N` sets 1–4096). See [rendering looks](RENDERING.md#photo-path-traced-stills). Software WebGL makes `photo` captures slow: the first compiles the tracing shader (up to a minute), then each sample costs seconds per megapixel, so pass a small `--samples` (16–64) for headless runs.

## Instruction publication

```sh
npm run cli -- instructions --input build.brickproj --format pdf --output instructions.pdf
npm run cli -- instructions --input build.mpd --format png-zip --max-per-step 10 --width 960 --height 720 --output step-images.zip
npm run cli -- instructions --input build.brickproj --format html-zip --camera fixtures/renders/interior.camera.json --output instructions-html.zip
```

Formats are `json` (default), `pdf`, `png-zip`, and `html-zip`. Existing imported/native plans retain their explicit ordering. `--plan-id ID` selects a native plan; otherwise the last available plan is selected. When there is no plan, or `--max-per-step N` is supplied, a layer sequence is generated. Do not combine `--plan-id` and `--max-per-step`.

Publishing fits the full model automatically unless an exact camera JSON file is supplied with `--camera`. This is the fallback camera for cumulative images; native plans can store a different camera for each step. Saved step notes are included in JSON, HTML and PDF. `--width`/`--height` default to 960×720. Publications include a coverage report; PDF includes a cover, step parts lists, complete inventory and attached instruction JSON. HTML ZIP contains a locally browsable `index.html` and step PNGs.

A complete plan must introduce every occurrence exactly once. Publishing rejects empty steps, missing/duplicate occurrences, stale revisions, and unsupported strict-render features. Limits: 200 steps, 5,000 occurrences, 4 megapixels per page, 64 megapixels total, bounded occurrence metadata, and 100 MiB output. These are organisational sequences; connections, structural support and assembly feasibility are not validated. Callouts and automatic assembly planning remain unavailable.

## Fixed-tick Play capture

```sh
npm run cli -- play --input fixtures/ldraw/studio.mpd --ticks 120 --move-forward 1 --locomotion walk --camera-mode first-person --width 1280 --height 720 --output play.png --report play.json
npm run cli -- play --input build.mpd --position '[0,-100,100]' --locomotion fly-noclip --camera-mode third-person --move-forward 1 --move-right 0.5 --ticks 60 --output fly.png
```

`--ticks` accepts 0–3,600 fixed 60 Hz ticks (default 120). `--move-forward`, `--move-right`, and `--vertical` accept values from −1 to 1; they default to zero. `--run` and `--jump` hold those inputs for the entire run. Movement is camera-relative. `--yaw` is radians; `--pitch` is constrained to −1.48…1.48 radians. `--position` is a JSON array of three LDraw coordinates, with negative Y upward. `--no-ground` disables the temporary exploration ground. Walking uses a safe supported spawn and may fall back to explicitly reported free flight.

The PNG captures the final Play camera. Its JSON report contains the rendering manifest, initial/final simulation snapshots, fixed tick count, input, avatar state, source revision, and software-rendering identification. The source file and authored document remain unchanged. Play exits before the browser closes.

Mechanisms, doors and physics:

```sh
npm run cli -- play --input fixtures/ldraw/door-room.ldr --position '[0,-0.3,220]' --open-doors --move-forward 1 --ticks 240 --output door.png --posed-output door-posed.ldr
npm run cli -- play --input physics.brickproj --rigs all --dynamic-rigs all --vehicle '{"rigId":"vehicle","throttle":1,"steering":0}' --motors '[{"rigId":"spinner","jointId":"axle","enabled":true}]' --joint-targets '[{"rigId":"door","jointId":"hinge","target":90,"speed":90}]' --ticks 90 --output physics.png
```

`--rigs all|JSON-array` activates authored rigs, and `--dynamic-rigs all|JSON-array` simulates them dynamically. `--joint-targets`, `--motors` and `--vehicle` take the same objects as `play.setJointTarget`, `play.setMotor` and `play.setMechanismVehicleInput`. They are applied after entry and before the input and ticks. Official LDraw doors hinge automatically: `--open-doors` opens every free door at 90 degrees/s, and `--no-auto-doors` keeps them static. `--posed-output` writes a static posed MPD of the final pose. The source file is never modified. The report's `playRun` records the applied targets, motors and vehicle input. Identical flags reproduce identical reports on the same machine and browser.

Trains ([running trains](PLAY-TRAINS.md)) run by default: `--train-throttle N` (−1..1 of full speed) starts every train before the ticks, `--points '[{"occurrenceId":"…","route":"branch"}]'` sets switches first, `--ride-train` puts the camera on the first train and `--no-trains` leaves rolling stock static. The report's `playRun` records the throttle and points, and `final.trains` the trains' positions, speeds and statuses:

```sh
npm run cli -- play --input fixtures/ldraw/templates/railway-station.mpd --train-throttle 1 --ticks 600 --ride-train --camera-mode third-person --output train.png --report train.json
```

Output reports default to `<output>.report.json`; `--report` overrides that path. Unknown flags, duplicate singleton flags, missing flag values, and out-of-range numeric inputs fail without writing a result. Existing files are overwritten only after a successful operation.

Model export profiles run without Chromium:

```sh
npm run cli -- export-profile --input model.brickproj --profile standard --scope visible --output visible.mpd
npm run cli -- export-profile --input model.brickproj --profile layers --include-complete --output layers.zip
npm run cli -- export-profile --input model.mpd --profile portable --include-official --output portable.zip
```

Use `--layer ID` (repeatable), `--scope selection --selection '["occurrence-id"]'`, or `--scope submodel --submodel 'occurrence-path-id'` for explicit scopes. Native profiles require `--scope all`. Unknown source metadata in filtered exports requires `--acknowledge-scoped-metadata`. Every operation writes a manifest report beside its output unless `--report` is supplied.

A portable official-library ZIP contains `model.mpd` with unchanged official references, exact licensed dependency files under `ldraw/parts` and `ldraw/p`, hashes and attribution. Extract it and configure the receiving LDraw editor to search that `ldraw` directory. This editor opens the extracted MPD, not the ZIP. Use the recipient's colour configuration; the package does not embed `LDConfig.ldr`. Project-local replacements keep their custom identity. Native backups remain necessary for layers, groups, purchasing overrides, assets and rigs.

## Connectors

```sh
npm run cli -- connectors --input build.ldr --output connectors.json
npm run cli -- connectors --input build.ldr --connected '["[\"n1\"]"]'
```

Reports the connector pack coverage, the verified stud-connected groups (largest first), parts without verified connector data and the number of stud contacts. `--connected` takes a JSON array of occurrence IDs and adds the connected assembly of those parts. See [connectors](CONNECTORS.md).

## Build scripts and part search

```sh
npm run cli -- build --script fixtures/build-scripts/santorini.json --output santorini.mpd
npm run cli -- build --script build.json --output build.brickproj --report build.report.json \
  --render views/build.png --views iso,front,iso-back,top --width 1280 --height 960
npm run cli -- build --script build.json --output build.mpd --target-parts 4000 --leeway 10   # 3,600–4,400 parts
npm run cli -- build --reference     # op reference with one example per op
npm run cli -- build --schema        # JSON Schema of build scripts
npm run cli -- parts search "cheese slope"
npm run cli -- parts search --size 1x2x1 --category Tiles --colour white --available --json
npm run cli -- parts list           # the 224 curated parts with their common colours (the agent prompt's part list)
```

`build` compiles a [build script](AGENT-BUILDING.md), runs the build checks (overlaps, stud grid, verified connectivity; `--no-check` skips them) and prints a summary with every problem and the op that caused it; the full report (JSON) goes to `--report` or next to `--output` (`.mpd`/`.ldr` for LDraw, `.brickproj` for a native project). The exit code is 2 when the report has errors. `--target-parts N` sets a part target and `--leeway P` the accepted percent either side (default 10; each copy of a component counts): outside that range the report's `over-budget` or `under-budget` error gives the total and by how much (and, when over, the costliest ops), and only the report is written (an older `--output` file is removed, no views are rendered). A script's `limits.maxParts` is a hard cap on top. `--render` writes one PNG per view from `--views` (`iso`, `front`, `back`, `left`, `right`, `top`, `iso-back`; cameras frame the build's bounds) with the usual `--look` and `--backdrop`; like `render`, it launches a private Vite server and headless Chromium (software WebGL: a 4,000-part build takes about a minute per view). The output is ordinary LDraw, so `health`, `connectors`, `inventory`, `render` and `play` take it as `--input`.

`parts search` ranks the curated catalogue and the complete library (see [API](API.md#build-scripts-and-part-search)); `--size` is `WxD`, `WxDxH` in plates or `WxDxHb` in bricks, `--available` keeps parts known in `--colour`, `--connectable` keeps parts with verified connectors, `--curated` searches only the catalogue. Columns: part, size (studs × studs × plates), curated or library, `snaps` when connectors are verified, colours known, existence in the colour, name.

## Reports without a browser

```sh
npm run cli -- validate --input model.mpd [--resource-profile mobile]
npm run cli -- health --input model.mpd              # overlaps, floating parts, connectivity
npm run cli -- query --input model.mpd --request query.json --output result.json
npm run cli -- floors --input model.mpd
npm run cli -- compare --input before.brickproj --against after.mpd
```

Each prints JSON (or writes it to `--output`). `query` takes the same request as the API's `query()`; `compare` reports occurrence-level changes between two files. Inventory, export, apply and instructions examples are in the [README](../README.md).
