# Featuring E · corrected part references — 28 October 2026

At the owner's request the gallery opens on **E · corrected part references**
(`e-reference-v2-20261014`, 52 builds) instead of **E · fresh builds**
(`e-fresh`, 21 builds). No build, prompt, agent, description or file changes.

`publication/` is a v4 reviewed bundle:

- `before-index.json`: the corrected-limit follow-up's reviewed index, which the
  live index matched on 28 October 2026.
- `index.json`: the same index with the featured flag moved.
- `publish.sql`: clears `e-fresh`'s `is_default`, then sets it on
  `e-reference-v2-20261014` (the unique featured index allows one at a time).
- `manifest.json`: checksums, the unchanged 135-build roster, no files.

Verify with `npx tsx scripts/publish-gallery-bundle.ts <publication>`. After
main validation, publish through the **Publish reviewed gallery generations**
workflow with collection `feature-reference-v2`.
