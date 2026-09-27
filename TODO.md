# Remaining work

The detailed backlog and acceptance gaps are maintained in [docs/STATUS.md](docs/STATUS.md), against [spec.md](spec.md). The current implementation is a working development build, not a complete P0 release.

Suggested order for the next implementation pass:

- [ ] Close M0 conformance gaps: BFC/conditional-line image comparisons, custom material scope, source assets and compiler budgets.
- [ ] Complete M2 editing: transform handles, clipboard, multi-selection, layer management, workplanes and arrays.
- [ ] Complete M3 reliability: portable exports, native migrations, multi-tab conflict UX, sustained-input autosave and graphics recovery.
- [ ] Extend inventory coverage and resolution UI beyond the curated starter mappings.
- [ ] Measure the specified performance gates, including the 5,000-part workload and reference hardware.
- [ ] After the P0 gates pass, implement M4 exploration, connectors and richer instructions.
- [ ] Implement M5/M6 mechanisms, physics and advanced planning in the order specified.

Use [docs/VERIFICATION.md](docs/VERIFICATION.md) for the existing test evidence and its limits. Update the status report and capability declarations when closing items; keep Play unavailable until its prerequisite gates pass.
