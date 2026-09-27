# Remaining work

The detailed backlog and acceptance gaps are maintained in [docs/STATUS.md](docs/STATUS.md), against [spec.md](spec.md). The current implementation is a working development build, not a complete P0 release.

Deployment follow-up: GitHub HTTPS still failed certificate verification on 2026-09-27; the user requested migration to Cloudflare Pages. Cloudflare Pages is deployed, the domain is active, DNS points to Pages, and HTTPS returns HTTP 200 with a valid certificate.

- [x] Verify secure live keyboard/touch controls at desktop, 360px and 1080px widths, including corrected steering, nearby interaction, multiple mechanisms and capture behavior.
- [ ] Add the repository Actions secret `CLOUDFLARE_API_TOKEN` (Pages Edit), then verify a successful automatic Wrangler upload. The account variable and workflow are configured; native Git build triggers are disabled because they failed to start builds. See [hosting configuration](docs/DEPLOYMENT.md).

Suggested order for the next implementation pass:

- [x] Reconcile occurrence-path schemas with valid nested documents, add aggregate request preflight and remove quadratic scope matching. Deep paths have a distinct canonical schema; ordinary IDs remain bounded.
- [ ] Bound aggregate expanded occurrence-path memory and remaining compiler work across valid project graphs; request preflight alone does not prove those limits.

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

Allowed-part masked fills and hinge/planar-vehicle creation are now implemented with preview and undo. Remaining: global packing optimization, connector-aware fill, compound-rig editing and arbitrary-frame authoring UI. Representable single-joint/vehicle rigs now support edit/removal with preserved imported data. Play strafing is camera-relative in both views and locomotion modes; keyboard and touch regressions cover the corrected left/right directions.

Structured browser/CLI queries now cover submodel/current-selection scopes, conservative source bounds, candidate overlaps and actionable dependency/physical-transform diagnostics without WebGL. Verified connectivity remains unavailable pending connector coverage.

Nearby Play interaction now supports E/touch joint open/close and on-foot vehicle control using movement keys/joystick. Multiple active rigs now share the Play world. Contextual doors/sliders now animate on fixed ticks, support reversal and report blocked retries. Follow-up: scene picking/line-of-sight, authored seats and collision-safe entry/exit, riding and vehicle/world collision response. These require an explicit simulation/authoring contract; the current vehicle action is labeled Control vehicle rather than Enter vehicle.
