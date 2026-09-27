# Remaining work

The detailed backlog and acceptance gaps are maintained in [docs/STATUS.md](docs/STATUS.md), against [spec.md](spec.md). The current implementation is a working development build, not a complete P0 release.

Suggested order for the next implementation pass:

- [ ] Close M0 conformance gaps: whole-library BFC coverage beyond the new ancestor/internal dependency fixtures, broader conditional-line image comparisons, custom material scope, source assets and compiler budgets.
- [ ] Complete M2 editing: connected-assembly selection, general structural regrouping, shared rotations and connector workplanes. Transform handles, visible/through box and lasso selection, clipboard, arrays, layer duplication, folders and ghosting now work.
- [ ] Complete M3 reliability: fully portable library packs, native migrations, broader storage recovery coverage and graphics recovery across more drivers. Bounded autosave and conflict-fork UI are implemented.
- [ ] Extend inventory coverage and resolution UI beyond the curated starter mappings.
- [ ] Measure the specified performance gates, including repeated 5,000-part trials and reference hardware (the current single-run software benchmark is recorded).
- [ ] Finish broader M4 exploration acceptance, connectors and advanced instruction editing. Play, publishing, sharing and pose application now work; user reprioritized exploration ahead of the remaining P0 gates.
- [ ] Complete M5/M6 dynamic physics, advanced rig authoring and planning in the order specified.

Use [docs/VERIFICATION.md](docs/VERIFICATION.md) for the existing test evidence and its limits. Update the status report and capability declarations when closing items; keep remaining compatibility and acceptance gaps explicit.

Implemented editing includes world/face/numerical workplanes, rotated fills, contiguous make-submodel, instance isolation, shared recolour/local translation, remappable shortcuts, shared keyboard/UI clipboard, export profiles and licensed geometry ZIPs. IndexedDB coordinates saves when Web Locks are unavailable; other-tab notices offer backup/reload or fork. Portable ZIPs still require recipient colour configuration and manual extraction. See STATUS for these boundaries.

Also implemented: moving authored mechanism colliders during exploration, touch Run/lost-input fixes, context-loss capture interruption/restoration, and editable instruction plans with notes/cameras. Remaining Play configuration includes selectable spawns, remappable movement keys and camera/profile controls. Moving mechanisms currently stop conservatively before the walking actor; riding, pushing and vehicle/world dynamics remain unfinished. Instruction callouts, arrows, exploded offsets, old-part dimming and assembly drafts remain open.
