# Derived occurrence limits

Occurrence collection now estimates shared model expansion before allocating paths and charges the same resources during traversal. The estimator visits each reachable source definition once and uses bounded arithmetic. Physical parts remain opaque occurrence leaves. A small shared graph can therefore be refused without first constructing its potentially enormous expanded strings.

The collector accepts trusted, explicit desktop/mobile options. Existing application callers use the desktop default; selecting a phone viewport does not yet select the mobile profile. Imported metadata cannot raise these limits.

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

The Editor and import UI still require a materializable scene. Opening an over-budget project into a dedicated source-only state, retaining deferred imported STEP plans, connecting effective profiles to UI/API/CLI, output pagination/budgets and cancellable derivation remain unfinished. A refused editor replacement retains the previous project; this checkpoint does not claim full limited-source UI support.

Tests cover arithmetic-only estimation of a 109-node source that would retain 36,286,900,000 ID characters, refusal before allocation, exact boundaries, independent saturation, Unicode/control characters, cached-reference depth, 100,000 flat leaves, source-native roundtrip and local recovery. The hostile fixture is never expanded.
