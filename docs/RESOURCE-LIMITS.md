# Derived occurrence limits

Occurrence collection now estimates shared model expansion before allocating paths and charges the same resources during traversal. The estimator visits each reachable source definition once and uses bounded arithmetic. Physical parts remain opaque occurrence leaves. A small shared graph can therefore be refused without first constructing its potentially enormous expanded strings.

The collector accepts trusted, explicit desktop/mobile options. The application now selects the profile per device (see "Effective resource profile" below). Imported metadata cannot raise these limits.

| Resource                     | Desktop default | Mobile profile |
| ---------------------------- | --------------: | -------------: |
| Leaves                       |         100,000 |         25,000 |
| Visited expanded nodes       |         200,000 |        200,000 |
| Reference depth              |              64 |             64 |
| Retained path-ID characters  |      67,108,864 |     16,777,216 |
| Generated path-ID characters |     134,217,728 |     33,554,432 |
| Retained path-array slots    |       6,400,000 |      1,600,000 |

Characters mean encoded UTF-16 code units, not UTF-8 bytes or measured browser heap. Generated characters include intermediate paths under the current collector. These budgets do not account for geometry, textures, JSON response escaping or all object overhead. Ordinary flat 100,000-part collections remain supported.

Trusted desktop callers may explicitly acknowledge a raised character budget, up to 536,870,912 retained and 1,073,741,824 generated characters. Graph count/depth caps cannot increase. There is no user-facing override flow yet; an application caller must show expected impact before setting the acknowledgement. Raising limits is not a guarantee that a browser has sufficient memory.

`validateSourceDocument` checks source structure, graph counts/depth and supplied instruction paths without collecting all occurrences. Indexed path resolution stops at physical-part boundaries and rejects missing, intermediate or repeated instruction members. Native encoding/decoding and local snapshot save/recovery use this source validation. A structurally valid small project can be backed up and recovered even when derived collection exceeds its character budget. `validateDocument` retains its existing scene-validation contract and returns a guarded collection.

The Editor can now admit structurally valid source that exceeds scene materialization limits. The source-only view removes the previous canvas, saves recoverable source where storage is available, and offers native/full-LDraw backups plus opening another project. Scene-dependent API actions return terminal `LIMIT_EXCEEDED`; `project.status()` reports source revision, availability and estimated costs. Invalid source replacements still retain the previous project. Ordinary edits cannot exceed the active policy or partially commit.

Imported STEP/ROTSTEP records remain authoritative source even when editable instruction derivation exceeds its resource budget. A deferred import has an explicit diagnostic and no misleading empty generated plan. Affordable derivation indexes root occurrences once and preserves source order; a pure helper can retry without overwriting authored plans. There is no user-facing derive-again or raised-budget control yet.

## Effective resource profile

`src/core/resource-profile.ts` holds the spec §21.2 table for both profiles: import bytes (25 / 10 MiB), decompressed archive bytes (100 / 40 MiB), embedded files (10,000 / 5,000), reference depth (64), expanded occurrences (100,000 / 25,000), net additions per command (10,000 / 2,000) and output image pixels (16 / 4 MP).

- **Selection:** phone-class devices (coarse pointer with a screen shorter side under 600 CSS px, or `navigator.deviceMemory` ≤ 2 GB) default to mobile; tablets and desktops keep desktop. The choice (automatic, phone or desktop limits) is stored per device.
- **Override:** choosing desktop limits on a device detected as a phone requires acknowledging the expected impact, in the UI (Project → Device limits, and the source-only view) and in the API (`resources.setProfile({ profile: "desktop", acknowledgeImpact: true })`). Limits cannot be raised above the desktop profile.
- **Enforcement:** `Editor.setResourceProfile` re-assesses the current document without a new revision, so a stricter profile can move it to the source-only view and back. Net occurrence growth per command is checked in the Editor for every command path; regrouping and undo/redo are not counted as additions. Imports (LDraw worker and native archives) and captures read the effective profile. The CLI takes `--resource-profile desktop|mobile`, and `validate` reports materialization under it.
- **Renderer:** part occurrences, part/colour variants and geometry triangles follow the profile; see "Renderer budgets" below.
- **Not yet profile-aware:** texture decoding (textures are not rendered), share URLs (the same caps for both profiles), output pagination and cancellable instruction derivation. The Editor currently accepts only default or lower trusted limits; it rejects raised policies until every scene consumer can honor them consistently. The collector itself still exposes the bounded acknowledged desktop override described above.

Tests cover arithmetic-only estimation of a 109-node source that would retain 36,286,900,000 ID characters, refusal before allocation, exact boundaries, independent saturation, Unicode/control characters, cached-reference depth, 100,000 flat leaves, source-native roundtrip and local recovery. The hostile fixture is never expanded.

Source-only browser checks cover 360 × 800 and 1080 × 1800, exact-model native backups, source exports, reload recovery, retained API handles, rapid limited-to-ordinary replacement, pending saves and blocked browser storage. The independent UX critic scored the corrected flow 8.8/10; see [UX audit](UX-AUDIT.md). This does not claim that the refused scene can be rendered.

## Renderer budgets

The renderer's budgets follow the effective resource profile (`src/render/render-budget.ts`). They replace the early reference-renderer caps of 5,000 part occurrences and 128 part/colour variants.

| Resource                                       | Desktop    | Phone      | Why                                                                                                                 |
| ---------------------------------------------- | ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------- |
| Physical part occurrences                      | 100,000    | 25,000     | The profile's expanded-occurrence limit (spec §21.2): anything the document admits can be drawn.                    |
| Raw type 2–5 source occurrences                | 100,000    | 25,000     | Same.                                                                                                               |
| Distinct part/colour/context variants          | 2,048      | 768        | Each variant is one prototype and one or three instanced draws. See the measurements below.                         |
| Unique geometry triangles (all compiled parts) | 2,000,000  | 600,000    | About 72 bytes per non-indexed triangle with normals, kept on the CPU and the GPU: ≈ 144 MB / 43 MB.                |
| Scene triangles (every occurrence)             | 60,000,000 | 16,000,000 | Per-frame draw cost: about 600 triangles per part at the occurrence limit. Beyond this a frame risks a GPU timeout. |
| Unused prototypes kept for undo/colour toggles | 256        | 64         | Previously every unused prototype was evicted once more than 128 existed, so larger models recompiled on undo.      |
| Reduced interactive quality above (scene tris) | —          | 4,000,000  | Phones then hide conditional edge lines and cap pixel density at 1.5× while viewing (reported; captures unchanged). |

- **Refusal is whole-model.** Counts are checked before compiling, and triangle budgets after compiling but before the scene changes. An over-budget model draws nothing (the previous view is hidden), `ready({ strict: true })` fails with `LIMIT_EXCEEDED` naming the resource, its size and the budget, and the document, query, health, source exports and inventory keep working. A phone refusal points to Project → Device limits. `render.budget()` reports the budget and the last model's measured use.
- **Changing the profile re-assesses the model**, so switching to desktop limits draws a model the phone profile refused, and back.
- **Variant cost.** With shared part geometry a colour variant costs a clone and three materials; a new part costs one compile (about 10 ms each on the VM after limiting each compile to the colours its source uses). 768 new parts on a phone therefore compile in several seconds, not tens of seconds. The measured 300-variant, 81-part stress model uses 52,075 unique geometry triangles (194,395 before sharing).
- **Play collision** keeps its one-million-triangle static budget. A world whose rendered surface is larger collides with simplified official parts: first without stud and underside-tube primitives, then, if still over budget, parts without doorways or arches become their bounding boxes. The 20,000-part stress village collides with 560,012 triangles and can be walked; Play reports the simplification. Worlds still over budget keep the Fly-only fallback.
- **Not budgeted yet:** transparent parts are drawn one object per occurrence (spec §13.2 keeps them on the reference path), so glass-heavy models have more draw calls; the JS heap of per-occurrence handles (about 10 KB per part) is bounded only by the occurrence limit.
