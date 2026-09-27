# Remaining work

The detailed backlog and acceptance gaps are maintained in [docs/STATUS.md](docs/STATUS.md), against [spec.md](spec.md). The current implementation is a working development build, not a complete P0 release.

Deployment follow-up: GitHub has validated `bricks.robertj.in` and Cloudflare DNS points to Pages, but TLS issuance was still pending on 2026-09-27.

- [ ] Verify the custom-domain certificate, enable Pages HTTPS enforcement, then run the live keyboard/touch smoke checks. See [hosting configuration](docs/DEPLOYMENT.md).

Suggested order for the next implementation pass:

- [ ] Close M0 conformance gaps: whole-library BFC coverage beyond the new ancestor/internal dependency fixtures, broader conditional-line image comparisons, custom material scope, source assets and compiler budgets.
- [ ] Complete M2 editing: connected-assembly selection, general structural regrouping, connector workplanes. Transform handles, visible/through box and lasso selection, clipboard, arrays, layer duplication, folders and ghosting now work.
- [ ] Complete M3 reliability: fully portable library packs, native migrations, broader storage recovery coverage and graphics recovery across more drivers. Bounded autosave and conflict-fork UI are implemented.
- [ ] Extend inventory coverage and resolution UI beyond the curated starter mappings.
- [ ] Measure the specified performance gates, including repeated 5,000-part trials and reference hardware (the current single-run software benchmark is recorded).
- [ ] Finish broader M4 exploration acceptance, connectors and advanced instruction editing. Play, publishing, sharing and pose application now work; user reprioritized exploration ahead of the remaining P0 gates.
- [ ] Complete M5/M6 dynamic physics, advanced rig authoring and planning in the order specified.

Use [docs/VERIFICATION.md](docs/VERIFICATION.md) for the existing test evidence and its limits. Update the status report and capability declarations when closing items; keep remaining compatibility and acceptance gaps explicit.

Implemented editing includes world/face/numerical workplanes, rotated fills, contiguous make-submodel, instance isolation, shared recolour/local translation/local pivot rotation, remappable shortcuts, shared keyboard/UI clipboard, export profiles and licensed geometry ZIPs. IndexedDB coordinates saves when Web Locks are unavailable; other-tab notices offer backup/reload or fork. Portable ZIPs still require recipient colour configuration and manual extraction. See STATUS for these boundaries.

Also implemented: moving authored mechanism colliders during exploration, touch Run/lost-input fixes, context-loss capture interruption/restoration, and editable instruction plans with notes/cameras. Play now includes validated session spawns, remappable movement keys and bounded camera settings. The audited camera fixtures now cover doorway/ceiling traversal and avatar occlusion; broader catalogue geometry and hardware acceptance remain unverified. Moving mechanisms currently stop conservatively before the walking actor; riding, pushing and vehicle/world dynamics remain unfinished. Instruction callouts, arrows, exploded offsets and assembly drafts remain open.

Latest additions: session Play layer exclusions independent of editor visibility, optional temporary ground, prior-part dimming for instruction preview/publication, and affine-preserving shared rotation around a declared local pivot.

Allowed-part masked fills and hinge/planar-vehicle creation are now implemented with preview and undo. Remaining: global packing optimization, connector-aware fill, general rig editing/removal UI and arbitrary-frame authoring UI. Play strafing is camera-relative in both views and locomotion modes; keyboard and touch regressions cover the corrected left/right directions.
