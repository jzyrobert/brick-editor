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
- **Not yet profile-aware:** texture decoding (textures are not rendered), share URLs (the same caps for both profiles), geometry/GPU memory budgets, output pagination and cancellable instruction derivation. The Editor currently accepts only default or lower trusted limits; it rejects raised policies until every scene consumer can honor them consistently. The collector itself still exposes the bounded acknowledged desktop override described above.

Tests cover arithmetic-only estimation of a 109-node source that would retain 36,286,900,000 ID characters, refusal before allocation, exact boundaries, independent saturation, Unicode/control characters, cached-reference depth, 100,000 flat leaves, source-native roundtrip and local recovery. The hostile fixture is never expanded.

Source-only browser checks cover 360 × 800 and 1080 × 1800, exact-model native backups, source exports, reload recovery, retained API handles, rapid limited-to-ordinary replacement, pending saves and blocked browser storage. The independent UX critic scored the corrected flow 8.8/10; see [UX audit](UX-AUDIT.md). This does not claim that the refused scene can be rendered.
