# Remaining work

The detailed backlog and acceptance gaps are maintained in [docs/STATUS.md](docs/STATUS.md), against [spec.md](spec.md). The current implementation is a working development build, not a complete P0 release.

Suggested order for the next implementation pass:

- [ ] Close M0 conformance gaps: ancestor BFC propagation in independently compiled renderer leaves, broader conditional-line image comparisons, custom material scope, source assets and compiler budgets.
- [ ] Complete M2 editing: connected-assembly selection, shared-definition editing and general workplanes. Transform handles, visible/through box and lasso selection, clipboard, arrays, layer duplication, folders and ghosting now work.
- [ ] Complete M3 reliability: fully portable library packs, native migrations, deeper multi-tab safeguards and graphics recovery. Bounded autosave and conflict-fork UI are implemented.
- [ ] Extend inventory coverage and resolution UI beyond the curated starter mappings.
- [ ] Measure the specified performance gates, including repeated 5,000-part trials and reference hardware (the current single-run software benchmark is recorded).
- [ ] Finish broader M4 exploration acceptance, connectors and instruction editing. Play, publishing, sharing and pose application now work; user reprioritized exploration ahead of the remaining P0 gates.
- [ ] Complete M5/M6 dynamic physics, advanced rig authoring and planning in the order specified.

Use [docs/VERIFICATION.md](docs/VERIFICATION.md) for the existing test evidence and its limits. Update the status report and capability declarations when closing items; keep remaining compatibility and acceptance gaps explicit.
