# Generation data audit — 14 October 2026

## Scope and outcome

Work starts from benchmark branch commit `351cde9c`, building on the completed Sol/Luna/Astra studies. Those studies tested information exposure, not catalogue correctness. This increment adopts verified data/contract corrections through **`factsVersion: "spatial-part-facts/2"`**. Use this reference for new generation runs. Keep v1 for frozen historical controls; no archived inputs, outcomes or gallery entries are changed.

The deterministic [catalogue audit](../fixtures/spatial-benchmark/audits/reference-v2.json) checks all **224 curated parts** against compiler placement dimensions: **10 legacy disagreements, zero v2 disagreements**. This is an agreement check, not independent physical certification. Separate pinned-triangle tests check the starter shapes and arch clearance; exported occurrence transforms check the coordinate conversion.

## Findings and disposition

| Finding                                                                                                                                                                 | Consequence                                                               | Correction or remaining limit                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search dimensions use rounded catalogue bounding height; placement uses its underside/reservation rules. Ten curated parts disagree, including 3659: 4 versus 3 plates. | Wrong filters and contradictory height advice.                            | v2 initial list, search filters/results and inspection use compiler placement dimensions, explicitly labelled as reservation dimensions. Physical bounds remain separate.                                                                                   |
| Palette filtering occurs after a global search capped at 200.                                                                                                           | A valid palette member can disappear even from an empty query.            | v2 filters the domain before ranking limits and partial-match fallback. Legacy default search behavior is preserved.                                                                                                                                        |
| Discovery omitted the partial-match flag.                                                                                                                               | A loose result may look like an exact answer.                             | v2 includes `partial`; role suggestions are explicitly not geometry/interface guarantees.                                                                                                                                                                   |
| The v1 arch clearance slab has negative local Y.                                                                                                                        | The old test proves free space below the arch, not a passage through it.  | v2 reports local `[25,0,-1]`–`[55,8,21]` LDU. Independent face clipping checks through both outer faces and catches shifts into the top and side support. The old assertion remains only for historical reference.                                          |
| `place` can emit a frame plus pane, or a wheel holder plus four wheel parts. Origin anchoring bypasses expansion.                                                       | Unexpected piece counts, blocked openings and inventory failures.         | Shared pane mapping feeds compiler and v2 metadata. Both search and detailed inspection disclose emitted-instance behavior. Actual compilation tests cover all three frames, wheels and origin anchoring. Geometry facts describe the requested part alone. |
| `targetParts` was advisory even when a brief required exactly 16.                                                                                                       | One 14-part Luna result was marked submitted.                             | New optional task `sizePolicy: "exact"` enforces count separately from compiler acceptance; absent/`advisory` preserves history. No-feedback rejects only after generation closes. Mechanical feedback reports count violations within existing budgets.    |
| Capability data said stud mating coverage was `yes` when connectors existed.                                                                                            | Availability could be mistaken for exhaustive verification.               | v2 says partial coverage; upright placement is not a promise of a usable stacking interface. Missing data remains unknown.                                                                                                                                  |
| Clockwise prose accompanies an explicit axis mapping; the reply example hardcodes seed 1.                                                                               | Viewpoint ambiguity and invalid submissions under another seed.           | v2 uses the explicit axis mapping and fills the declared seed. No rotation semantics changed.                                                                                                                                                               |
| Colour absence is interpreted as “not made” by legacy compiler prose.                                                                                                   | A pinned snapshot can be mistaken for exhaustive real-world availability. | v2 states the evidence limit. Compiler acceptance/color policy is unchanged; no external colour dataset is imported.                                                                                                                                        |

The corrected reference also accepts half-stud **dimension filters**, matching existing footprint sizes. Placement coordinates remain constrained by the current language; this does not add half-stud placements or new poses.

The audit also found a process-state hazard: preflight can compose full-library facts before the geometry registry is loaded, while live sessions register it first. v2 explicitly loads and verifies the pinned library/catalogue before composing inputs. A fresh-process regression compares the initial and registered-host prompts for a non-curated part.

## Use and reproduction

Select `"factsVersion": "spatial-part-facts/2"` in a new manifest. Add `"sizePolicy": "exact"` to tasks requiring an exact count. Counts are compiler-emitted library instances, not certified physical-piece counts for shortcuts. Exact-count policies cannot use legacy count/error feedback. Shape/connector fields and automatic/on-demand exposure remain independently declared.

```sh
# Read-only catalogue audit; refuses to overwrite an existing output.
npx tsx scripts/spatial-reference-audit.ts --out .local/reference-audit.json

# One-case smoke manifest, no model calls.
npx tsx scripts/spatial-benchmark.ts \
  --manifest fixtures/spatial-benchmark/manifests/reference-v2.json \
  --out .local/reference-preflight --mode preflight

npx vitest run tests/unit/spatial-reference-v2.test.ts \
  tests/unit/spatial-part-reference.test.ts \
  tests/integration/spatial-benchmark.test.ts
```

The new reference replaces the filled curated list and adds technical explanations; it is a distinct effective input, even with shape/connector fields off. All arms in a future information comparison must use the same reference version. The original E/diorama files, reply examples, richer-facts mode and v1 payload snapshots stay unchanged. General one-shot and editor search defaults still use the legacy path; use the manifest runner for corrected generation. No claim is made that the same prompt bytes now produce better designs.

## Further audit and limitations

- Detailed contours/surface extents still cover five starter parts. Other physical bounds are conservative estimates; do not infer openings or slope directions from names or envelopes.
- Collision boxes approximate surfaces and can miss containment. A verified connector list is not proof of stable support, valid assembly order or an expressible mating pose.
- Full-library nominal dimensions share compiler conventions, which can round geometry and use conservative envelopes. The 224-part audit does not certify every full-library part.
- Mirror, group and instance semantics differ from placing a rotated part. This increment explains anchors but does not expand or independently certify every macro/transform combination.
- Massing count formulas are empirical estimates, not promises. Exact-count checks operate on emitted instances; physical shortcut expansion counting remains deferred.
- Old calibration runs involving free space below an arch cannot establish use of an interior opening. Their frozen results are retained; the new geometry fixture supplies narrower, independently checked evidence.
- The generic CLI dry-run probe uses two 3001 bricks. It is not inventory-conforming for the slope smoke manifest, so it correctly ends as model-failure. A separate replay of the valid slope/plate fixture passes exact-count acceptance with zero model calls.

Implemented: corrected versioned references/search, explicit count validity and reproducible data audit. Tested: deterministic geometry, catalogue agreement, compiler emission, legacy preservation and isolated session behavior (see [verification](VERIFICATION.md)). Experimentally evaluated: no new model runs. Deferred: catalogue-wide physical certification, physical shortcut counting, larger design studies and untested assembly/structural properties.
