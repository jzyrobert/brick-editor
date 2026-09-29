# Rendering looks

The viewport and captures offer three shading looks. The look is a separate setting from the render quality profile (`fast`/`balanced`/`photo`, which controls edges, shadow map size, pixel-ratio cap, tone mapping and exposure). A look never changes the document, the geometry or the stored quality profile.

| Look                 | What it draws                                                                                                                                                                                                                                                              | Where                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **Standard** default | The original look: hemisphere + sun + fill lights, LDraw edge and conditional lines, `MeshStandardMaterial` values from LDrawLoader. Unchanged, drawn directly to the canvas.                                                                                              | Everywhere; the capture default     |
| **Realistic**        | Image-based lighting, tuned ABS/finish materials, soft shadows fitted to the model on a shadow-catcher ground, ambient occlusion, no outlines, PBR Neutral tone mapping, a light vignette.                                                                                 | Interactive and captures            |
| **Photo**            | Realistic, and a still view keeps refining: each idle frame adds one jittered sample (sub-pixel camera offset for anti-aliasing, key light moved over a disc for area-light penumbrae) to a running average, up to 32 samples, then drawing stops. Captures accumulate 32. | Interactive (when still) and stills |

Choose a look in **Camera views → Look**. The choice is stored per viewer (`localStorage` key `brick-editor-render-look`, ignored when storage is unavailable). Photo-mode captures use the chosen look. Automation: `render.look.get()`, `render.look.set(name, controls?)`, and `render.image({ …, look?, lookControls? })`, which defaults to `standard` so existing captures stay byte-identical. The capture manifest records the resolved `look` and whether the output was tone-mapped. The CLI takes `--look standard|realistic|photo` for `render`, `render-collection` and `play`.

`lookControls` (bounded, validated): `environment` `none|room`, `materials` `ldraw|plastic`, `ambientOcclusion` `off|gtao`, `edges` `quality|hidden`, `shadows` `quality|soft`, `ground` `grid|shadow`, `samples` 1–64, `vignette` 0–0.5, `toneMapping` `quality|neutral`, `exposureScale` 0.25–4.

## Phones and Play

On the mobile resource profile, Realistic keeps the cheap parts (IBL, materials, fitted 1024² soft shadows, shadow ground, no outlines) and drops ambient occlusion and the vignette. It then draws directly to the canvas like Standard, with no off-screen targets. Photo on phones keeps AO, uses 2× MSAA and 12 samples, and is opt-in. Play never accumulates samples (every Play frame moves), and phones also drop AO while playing. Play's pixel-ratio cap (`PLAY_PIXEL_RATIO_CAP`) applies to every look.

## Frame cost on large models

Large real-parts builds (10,000–30,000 parts) are drawn through render-only batches (`src/render/batching.ts`); the occurrence handles stay authoritative for picking, selection, collision and export. Measurements are in [VERIFICATION.md](VERIFICATION.md#frame-cost-on-large-real-parts-models-29-september-2026).

- **Buckets are built once, then refilled.** Every drawable of every handle, visible or not, is classified once per model update into buckets keyed by geometry, base material and render order. Visibility (instruction steps, layers, floor focus, Play inclusion, edge modes), treatments (layer ghosting, floor ghosting, instruction dimming), transforms (explode) and section cuts only rewrite each bucket's instance matrices and counts in its existing draws. Before, each of these rebuilt every batch, and a dimmed or ghosted part fell back to one draw per drawable (about 48,000 draws for an instruction step of the 20,000-part fixture).
- **Treatments are instanced.** `LayerGhost` registers each transparent clone with its base material (`registerTreatment`), so a ghosted or dimmed occurrence stays in its bucket and moves to a second draw of that bucket with the clone material (depth write off, drawn after opaque parts, sorted per draw).
- **Transparent parts are instanced** like opaque ones. Instances of one bucket share one material, so the order in which they blend does not change the colour; draws are still sorted against each other. A bucket with a single occurrence is drawn as a plain copy.
- **Section cuts** also leave out instances wholly beyond the plane; the clipping plane still cuts the parts it crosses.
- **Adaptive quality while moving.** Above `motionReductionTriangles` scene triangles (desktop 4 M, phone 500 k; see `render-budget.ts`), frames drawn while the view moves (orbit, zoom, pinch, transform drags, Play camera) leave out edge and conditional lines by hiding their batch draws (no refill), and phones draw at ≤ 1.25× pixel density (`MOTION_PIXEL_RATIO_CAP`). The view redraws once at full quality `MOTION_IDLE_MS` (180 ms) after the last motion, or when the drag ends. Captures never use the reduced state. `render.budget()` reports `motion` and the last frame's draw statistics.
- **Shadow maps are cached.** Shadows (a look's soft shadows or the photo quality profile) re-render only when the scene changes. Camera-only frames, including Play frames where only the camera or the figure (which casts no shadow) moved, reuse the map; moving mechanism parts re-render it. `lastFrame.shadowPasses` counts shadow renders.
- **Indexed part geometry.** After compilation, each new prototype's triangle meshes are indexed once (`src/render/geometry-index.ts`): corners with bit-identical attributes merge, so the vertex shader runs once per shared corner. Groups, picking (`face.a/b/c`), collision extraction and baked batches read indexed geometry already.
- **Picking** tests triangle meshes only, after a per-handle box broadphase ordered by distance with an early exit, and no longer recomputes every world matrix per pick.
- **Spatial cells** (`?batchCells=<LDU>`, off by default) split large buckets per region so frustum culling works in close views. They multiply draw calls in whole-model views, so they are a diagnostic, not a default.

## How it is built

- **Environment**: three's `RoomEnvironment` prefiltered with `PMREMGenerator` at first use. It is generated on the GPU, so nothing is fetched and the site stays self-contained under its CSP. It is regenerated after a context loss, because render-target contents are lost, and freed when the look returns to Standard. With IBL on, the hemisphere/key/fill lights drop to 0.25/2.0/0.2, from 3/3/1.5 (`LOOK_LIGHTING`).
- **Materials**: LDrawLoader's `MeshStandardMaterial`s are tuned in place and restored exactly from `userData.lookBase`. In-place tuning keeps batching keys, prototype sharing and the layer-ghost/instruction-dimming clones working. Finishes are classified from the loader's finish values and the LDConfig name (`FINISH_PARAMETERS`):

  | Finish                       | Roughness | Metalness | Env. intensity |
  | ---------------------------- | --------- | --------- | -------------- |
  | Plastic (ABS)                | 0.24      | 0         | 1              |
  | Transparent                  | 0.04      | 0         | 1.6            |
  | Chrome                       | 0.06      | 1         | 1.2            |
  | Pearlescent                  | 0.32      | 0.55      | 1.1            |
  | Metal                        | 0.28      | 0.9       | 1.1            |
  | Matte metallic               | 0.48      | 0.7       | 1              |
  | Rubber                       | 0.82      | 0         | 0.55           |
  | Glitter (transparent) flakes | 0.06      | 0         | 1.6            |
  | Speckle                      | 0.3       | 0         | 1              |

  LDConfig `MATERIAL GLITTER|SPECKLE` lines, which LDrawLoader ignores, become procedural world-space flakes in an `onBeforeCompile` hook with its own program cache key. Glitter flakes are mirror-like. Speckle density is halved and flakes are enlarged 1.2×, because cube cells at the stated density read as noise.

- **Pipeline** (`LookPipeline`): the scene is drawn into a half-float HDR target (4× MSAA on desktop, 2× on phones) that has a depth texture. Three's `GTAOPass` then runs on the **resolved beauty depth**, with normals reconstructed from depth, at half resolution and clipped to the model's bounds. AO therefore costs no second geometry pass. The r174 constructor crashes when given a depth texture, so the adapter sets it afterwards. A composite pass tone-maps (PBR Neutral), composites over the background, multiplies AO, adds dark AO/shadow coverage over transparent backgrounds, and applies the vignette. With accumulation, it blends into a premultiplied running average in ping-pong half-float targets, and a present pass encodes to the canvas or the sRGB capture target.
- **Shadows**: the key light's orthographic shadow frustum is fitted to the model's bounding sphere, instead of the fixed ±1500 LDU. The map is at least 2048² (1024² on phones), so shadows are crisp on small models. A `ShadowMaterial` plane at the model's lowest point receives shadows and writes depth for contact AO. The grid is dimmed to 45%.
- **Tone mapping**: ACES bleached sunlit yellow and red tops to cream, so the realistic looks use Khronos PBR Neutral, with exposure × 0.85 of the quality profile's.

## Findings

Measured on the `fixtures/ldraw/finishes.mpd` fixture (111 parts covering plastic, transparent, chrome, pearl, metal, rubber, glitter and speckle) in headless Chromium with **SwiftShader software WebGL** on the ARM64 VM. Absolute numbers are CPU rasterisation and are only meaningful relative to each other. Each frame is a synchronous draw followed by a 1-pixel readback, after draining the previous frame.

Per orbit frame (median of 24 frames; OrbitControls-style camera-only change; `draws` = draw calls in that frame):

| Look / variant                         | Desktop 1440×900 (buffer 1440×900) | Phone 390×844 DPR 3 (buffer 780×1688) |
| -------------------------------------- | ---------------------------------- | ------------------------------------- |
| Standard                               | 130 ms · 88 draws                  | 143 ms · 82 draws                     |
| Realistic without AO/vignette (direct) | 471 ms · 31 draws                  | 447 ms · 29 draws (phone default)     |
| Realistic                              | 987 ms · 34 draws                  | —                                     |
| Photo, while moving                    | 983 ms · 35 draws                  | 867 ms · 33 draws                     |

Phone attribution, same setup: Realistic with no environment 373 ms, and with neither shadows nor shadow ground 297 ms. On software rasterisation, per-pixel environment and PCF shadow sampling dominate. Desktop attribution: the HDR pipeline plus half-resolution GTAO roughly doubles the direct realistic frame. Full-resolution GTAO doubled the AO cost again (≈2× the realistic frame in the first run), as did swapping to physical transmission (+23 draws, +60 %). Clearcoat added ~10 %. A Photo still reaches 32 samples in about 12 s headless (12 samples on phones in about 7 s), then stops drawing. Photo captures cost the sample count × one frame (900×600: about 43 s headless versus 4–5 s for Realistic).

Draw calls fall in the realistic looks because outlines are hidden and the shadow map is cached. With forced shadows, the shadow map is re-rendered only after a scene change (`invalidate()`), not on camera-only orbit frames (`invalidate({ cameraOnly: true })`) — without this, the shadow pass doubles the draws of every orbit frame. Phones filter look shadows with plain PCF. The Standard look's frame, draws and captures are unchanged.

Real GPUs are far faster at texture sampling and fill than SwiftShader, so these ratios are an upper bound. The phone numbers still justify the mobile degradations and keeping every realistic look opt-in; real-device measurement remains open.

| Technique                                   | Verdict                                                                                                                                                                                                                                                                                             |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Room-environment IBL (PMREM)                | **Shipped.** Largest single gain: chrome and metal stop rendering black, and plastic gets believable reflections. Generating the environment is a one-off of about 0.1–0.3 s, it adds no asset bytes, and each frame costs little.                                                                  |
| Tuned finish materials (in place)           | **Shipped.** No extra passes. Speckle and glitter flakes are cheap shader hooks.                                                                                                                                                                                                                    |
| Hidden LDraw outlines                       | **Shipped** in the realistic looks. Real bricks have no outlines, and hiding them removes all line draw calls (−25 to −30 calls on the fixture). Standard keeps them.                                                                                                                               |
| Fitted soft shadows + shadow-catcher ground | **Shipped.** One shadow-map pass. Fitting the frustum to the model fixed the blurry fixed-extent map.                                                                                                                                                                                               |
| GTAO on resolved depth                      | **Shipped** (desktop). Contact darkening at stud bases and between bricks. Reusing the beauty depth avoids GTAO's default normal/depth re-render of the scene. The model clip box removes horizon noise. Half resolution is the default; full resolution was barely distinguishable and costs more. |
| PBR Neutral tone mapping                    | **Shipped** for the realistic looks. It keeps LEGO colours saturated where ACES washes out top faces.                                                                                                                                                                                               |
| Jittered accumulation (photo)               | **Shipped** as the Photo look. Clean anti-aliased edges and soft area-light penumbrae on stills. Each sample costs one realistic frame; captures cost samples × frame time.                                                                                                                         |
| `MeshPhysicalMaterial` clearcoat            | **Rejected.** A sharper second highlight is barely visible at editor distances. It needs swapping every material, which breaks the in-place tuning, batching keys and ghost treatments, and it runs the heavier physical shader.                                                                    |
| Physical transmission for transparent parts | **Rejected.** Transmission renders an extra opaque-scene pass for each frame. Against the pipeline's transparent-cleared HDR target, parts turned almost invisible, and it added draw calls. Alpha blending with strong environment reflections reads better.                                       |
| SSAO/SAO, N8AO                              | Not adopted. GTAO ships with three (no new dependency) and was sufficient. N8AO would be a new dependency.                                                                                                                                                                                          |
| Depth of field, SMAA/FXAA                   | Not adopted. MSAA on the HDR target and accumulation in Photo already anti-alias. Depth of field hurts an editing view and adds little to a small still.                                                                                                                                            |
| Path tracing (three-gpu-pathtracer)         | Not adopted. It would add a large dependency and a BVH over up to 5,000 parts of LDraw geometry, and it cannot be verified usefully on software WebGL. Accumulation gives most of the still-image gain.                                                                                             |
| Logo on studs                               | Not available. The pinned starter library has no logo stud primitives.                                                                                                                                                                                                                              |

Also found: **direct (Standard) captures are not tone-mapped.** Three applies tone mapping only when drawing to the canvas, so `render.image` output from the Standard look is linear→sRGB without ACES/exposure, whatever the manifest's `toneMapping` says. The manifest now reports `output.toneMapped`. Look-pipeline captures are tone-mapped. The Standard capture path was left unchanged to keep existing images byte-identical. Routing it through the pipeline is a follow-up.

Screenshots of the fixture in each look, 1440×900 and 390×844: [docs/screenshots/looks](screenshots/looks).
