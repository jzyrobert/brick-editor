# Reviewed text-only gallery generations

Fresh E is the featured collection: six original briefs with Sol 6.1, Astra 6
and Opus 5.5 at high effort. The complete index retains 80 builds across nine
text-only generations. Fresh and source-conditioned E/F runs have separate
labels; earlier A/B/C, creative and original-rule cohorts remain browsable.
Image-input and visual-feedback experiments are excluded.

`manifest.json` records the exact before/after roster, cohort counts, featured
generation, 480 immutable files, publication SQL/index hashes and the 38 newly
published input/script hashes. The other 42 entries preserve their previously
published files and accepted reports. `before-rows.json` records the production
baseline: 18 visible E source revisions and 24 hidden earlier builds.

All new MPDs exactly match the saved accepted study outputs. Their three views
are rerendered with the shared gallery settings: Realistic look, white backdrop,
1,280 × 960 WebP. These finished renders are for visitors and review; they are
never sent back to the generating models. Compiler warnings remain in the
reports. The fresh E input is byte-identical across models for each brief.

Verify the bundle from the repository root:

```sh
npx tsx scripts/publish-gallery-bundle.ts docs/samples/lego-style-study/generation-publication
```

The main-only gallery workflow requires successful validation of that main
commit, applies migration `0003_prompt_generations.sql`, checks the live visible
roster, uploads immutable files, applies only the reviewed SQL, then verifies
live metadata against the reviewed index before publishing `index.json`.
Remote publishing needs gallery-capable D1/R2 credentials; the existing Pages
credential's gallery access remains an open TODO. An authenticated owner
connection can apply the same reviewed operations after main validation.

SQL retains every source and allows only the reviewed 80 IDs to become visible.
`rollback.sql` restores the old 18-build visibility and removes generation
assignments from those visible entries, retaining all assets and rows. Rebuild
and publish the index after rollback; refresh only the index cache. The migration
can remain in place because generation metadata is optional for older indexes.

See [gallery behavior](../../../GALLERY.md#prompt-generations),
[the independent E/F comparison](../fresh-e/README.md), and
[the historical source-revision study](../README.md).
