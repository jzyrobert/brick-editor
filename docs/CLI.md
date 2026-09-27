# Local command-line rendering and publishing

Run commands from the repository with Node 22.14 or later after `npm ci` and `npx playwright install chromium`.

Inventory, validation, native/LDraw conversion, command application, and instruction JSON run directly in Node. PNG capture, Play capture, and PDF/PNG/HTML publication launch a temporary loopback server and local Chromium, then close both. No remote renderer or keyboard emulation is used.

## Instruction publication

```sh
npm run cli -- instructions --input build.brickproj --format pdf --output instructions.pdf
npm run cli -- instructions --input build.mpd --format png-zip --max-per-step 10 --width 960 --height 720 --output step-images.zip
npm run cli -- instructions --input build.brickproj --format html-zip --camera fixtures/renders/interior.camera.json --output instructions-html.zip
```

Formats are `json` (default), `pdf`, `png-zip`, and `html-zip`. Existing imported/native plans retain their explicit ordering. `--plan-id ID` selects a native plan; otherwise the last available plan is selected. When there is no plan, or `--max-per-step N` is supplied, a layer sequence is generated. Do not combine `--plan-id` and `--max-per-step`.

Publishing fits the full model automatically unless an exact camera JSON file is supplied with `--camera`. The same camera is used for all cumulative step images. `--width`/`--height` default to 960×720. Publications include a coverage report; PDF includes a cover, step parts lists, complete inventory and attached instruction JSON. HTML ZIP contains a locally browsable `index.html` and step PNGs.

A complete plan must introduce every occurrence exactly once. Publishing rejects empty steps, missing/duplicate occurrences, stale revisions, and unsupported strict-render features. Limits: 200 steps, 5,000 occurrences, 4 megapixels per page, 64 megapixels total, bounded occurrence metadata, and 100 MiB output. These are organisational sequences; connections, structural support and assembly feasibility are not validated. Callouts and automatic assembly planning remain unavailable.

## Fixed-tick Play capture

```sh
npm run cli -- play --input fixtures/ldraw/studio.mpd --ticks 120 --move-forward 1 --locomotion walk --camera-mode first-person --width 1280 --height 720 --output play.png --report play.json
npm run cli -- play --input build.mpd --position '[0,-100,100]' --locomotion fly-noclip --camera-mode third-person --move-forward 1 --move-right 0.5 --ticks 60 --output fly.png
```

`--ticks` accepts 0–3,600 fixed 60 Hz ticks (default 120). `--move-forward`, `--move-right`, and `--vertical` accept values from −1 to 1; they default to zero. `--run` and `--jump` hold those inputs for the entire run. Movement is camera-relative. `--yaw` is radians; `--pitch` is constrained to −1.48…1.48 radians. `--position` is a JSON array of three LDraw coordinates, with negative Y upward. `--no-ground` disables the temporary exploration ground. Walking uses a safe supported spawn and may fall back to explicitly reported free flight.

The PNG captures the final Play camera. Its JSON report contains the rendering manifest, initial/final simulation snapshots, fixed tick count, input, avatar state, source revision, and software-rendering identification. The source file and authored document remain unchanged. Play exits before the browser closes.

Output reports default to `<output>.report.json`; `--report` overrides that path. Unknown flags, duplicate singleton flags, missing flag values, and out-of-range numeric inputs fail without writing a result. Existing files are overwritten only after a successful operation.
