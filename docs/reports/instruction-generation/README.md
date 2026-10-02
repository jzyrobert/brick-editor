# Instruction research and review

This directory retains written research, evaluation summaries and independent
critic findings. Product behavior and reproduction commands are documented in
[INSTRUCTION-GENERATION](../../INSTRUCTION-GENERATION.md),
[AGENT-INSTRUCTIONS](../../AGENT-INSTRUCTIONS.md) and
[HYBRID-INSTRUCTIONS](../../HYBRID-INSTRUCTIONS.md).

The latest [source-guided review](source-guided-articulation-critic.md) accepts
the bounded head/jaw increment while rating the complete Shark draft 2/5. The
[hybrid trial](hybrid-workflow.md) and [critic](hybrid-workflow-critic.md) record
targeted improvements with unchanged paired overall scores: Roadster, House and
Police Truck 3/5; Shark 2/5. These are desk reviews, not physical builder trials.

## Local artifacts

Generated instruction plans, native trial projects, proposals, raster galleries,
phone screenshots, HTML/PDF/ZIP booklets, machine-readable evaluation dumps,
execution logs and one-off verification scripts are deliberately excluded from
this PR and ignored here. Earlier reports describe the original review and may
retain artifact names, hashes and local paths; those outputs are not committed.
The previous archive is preserved on the development VM under
`.local/pr-cleanup-20261002/instruction-generation/`.

Maintained evaluation and workbench commands write new outputs to `.local/`:

```sh
npm run instructions:evaluate -- --fetch --render --output .local/instructions
npm run instructions:hybrid -- prepare --input fixtures/ldraw/templates/roadster.mpd --output .local/hybrid-roadster
```

Fetching official models is explicit and throttled. CI tests do not fetch them.
The six unmodified OMR source models in
[fixtures/instructions/omr](../../../fixtures/instructions/omr/NOTICE.md) are
small inputs needed by automated regression tests, not generated instructions;
their original attribution and hashes remain intact. Source code, prompts and
automated unit/browser tests remain part of the feature.

Proprietary LEGO manuals and private user models are not redistributed.
