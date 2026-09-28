# Remaining work

The detailed backlog and acceptance gaps are maintained in [docs/STATUS.md](docs/STATUS.md), against [spec.md](spec.md). The current implementation is a working development build, not a complete P0 release.

Deployment follow-up: GitHub HTTPS still failed certificate verification on 2026-09-27; the user requested migration to Cloudflare Pages. Cloudflare Pages is deployed, the domain is active, DNS points to Pages, and HTTPS returns HTTP 200 with a valid certificate.

- [x] Verify secure live keyboard/touch controls at desktop, 360px and 1080px widths, including corrected steering, nearby interaction, multiple mechanisms and capture behavior.
- [x] Automatic Cloudflare deploys: the `CLOUDFLARE_API_TOKEN` secret (Pages Edit) is configured, and every push to `main` that passes format, unit, library and browser checks is published with Wrangler (first verified 2026-09-28, deployment for 8289bb3). See [hosting configuration](docs/DEPLOYMENT.md).

Suggested order for the next implementation pass:

- [x] Fix the reported Santorini MPD loading failure: raw primitives compile/batch efficiently with preserved source identities, non-certified faces render lit, and projects persist in IndexedDB beyond the localStorage quota. See STATUS "Raw-geometry architectural imports".
- [ ] Measure raw-geometry import performance (load, capture, draw calls, memory) on real phone hardware; current evidence is software WebGL on a desktop-class VM.

- [x] Implement the authored open-bench driver-seat slice: collision-checked entry/exit, atomic rider/vehicle movement, seated visuals, API/capture reporting and mobile UX audit. Runtime, metadata editing, focused browser acceptance and an independent 8.7/10 mobile review pass; final integrated CI remains the publication gate.

- [x] Reconcile occurrence-path schemas with valid nested documents, add aggregate request preflight and remove quadratic scope matching. Deep paths have a distinct canonical schema; ordinary IDs remain bounded.
- [x] Guard aggregate expanded path storage/work before and during occurrence collection; preserve native backup and local recovery without materializing the scene.
- [x] Open over-budget projects in a source-only recovery view with native/full-source backups; defer imported STEP derivation without dropping source records.
- [x] Effective resource profiles: automatic phone/desktop selection, acknowledged desktop override on phones, Editor/import/archive/capture/CLI enforcement. See [resource limits](docs/RESOURCE-LIMITS.md).
- [ ] Remaining resource work: geometry/GPU memory budgets, output pagination, cancellable instruction derivation and a user-facing derive-again control.
- [ ] Bound remaining compiler work across valid project graphs; occurrence guards alone do not prove those limits.

- [ ] Close M0 conformance gaps: whole-library BFC coverage beyond the new ancestor/internal dependency fixtures, broader conditional-line image comparisons, custom material scope, source assets and compiler budgets.
- [ ] Complete M2 editing: connected-assembly selection, general structural regrouping, connector workplanes. Transform handles, visible/through box and lasso selection, clipboard, arrays, layer duplication, folders and ghosting now work.
- [ ] Complete M3 reliability: fully portable library packs, native migrations, broader storage recovery coverage and graphics recovery across more drivers. Bounded autosave and conflict-fork UI are implemented.
- [x] Expand the placeable catalogue (214 official parts, 12 categories) with rendered thumbnails, a scalable picker and bounds-derived placement. See STATUS "Catalogue expansion".
- [ ] Catalogue follow-ups: connector data for snapping, decoration/print variants, per-colour thumbnails for glass, and a second library pack loaded progressively beyond the curated set.
- [ ] Extend inventory coverage and resolution UI beyond the curated catalogue mappings (five catalogue parts are unmapped; see `mappings.json` `unmapped`).
- [ ] Measure the specified performance gates, including repeated 5,000-part trials and reference hardware (the current single-run software benchmark is recorded).
- [x] Revision review (spec §20.3): named checkpoints, occurrence-level change reports (UI/API/CLI), model-health panel and camera collections.
- [x] Architectural aids (spec §20.2): horizontal and vertical section cuts, measure tool, exploded floors, floor guides with floor focus (upper floors hidden, lower floors ghosted, saved per camera bookmark) and room labels. Follow-up: room outlines/areas and dimension-string overlays. See STATUS "Floor guides, floor focus and room labels".
- [x] Photorealistic rendering investigation: Standard (default), Realistic (IBL, tuned finishes, GTAO, fitted soft shadows, no outlines) and Photo (still accumulation) looks in Camera views, API and CLI. See [rendering looks](docs/RENDERING.md).
- [ ] Rendering follow-ups: measure the Realistic/Photo looks on real phone GPUs; route Standard captures through the tone-mapping pipeline (they are currently not tone-mapped); consider logo-on-stud primitives once the library includes them.
- [x] Creative-mode HUD redesign for phone/tablet/desktop (see DESIGN.md). Follow-up: migrate legacy panel-content styles (slate tones, 11px help text) to the DESIGN.md scale.
- [ ] Finish broader M4 exploration acceptance, connectors and advanced instruction editing. Play, publishing, sharing and pose application now work; user reprioritized exploration ahead of the remaining P0 gates.
- [ ] Complete M5/M6 dynamic physics, advanced rig authoring and planning in the order specified.

Use [docs/VERIFICATION.md](docs/VERIFICATION.md) for the existing test evidence and its limits. Update the status report and capability declarations when closing items; keep remaining compatibility and acceptance gaps explicit.

Implemented editing includes world/face/numerical workplanes, rotated fills, contiguous make-submodel, instance isolation, shared recolour/local translation/local pivot rotation, remappable shortcuts, shared keyboard/UI clipboard, export profiles and licensed geometry ZIPs. IndexedDB coordinates saves when Web Locks are unavailable; other-tab notices offer backup/reload or fork. Portable ZIPs still require recipient colour configuration and manual extraction. See STATUS for these boundaries.

Also implemented: moving authored mechanism colliders during exploration, touch Run/lost-input fixes, context-loss capture interruption/restoration, and editable instruction plans with notes/cameras. Play now includes validated session spawns, remappable movement keys and bounded camera settings. The audited camera fixtures now cover doorway/ceiling traversal and avatar occlusion; broader catalogue geometry and hardware acceptance remain unverified. Moving mechanisms currently stop conservatively before the walking actor; riding, pushing and vehicle/world dynamics remain unfinished. Instruction callouts, arrows, exploded offsets and assembly drafts remain open.

Latest additions: session Play layer exclusions independent of editor visibility, optional temporary ground, prior-part dimming for instruction preview/publication, and affine-preserving shared rotation around a declared local pivot.

Allowed-part masked fills and hinge/planar-vehicle creation are now implemented with preview and undo. Remaining: global packing optimization, connector-aware fill, compound-rig editing and arbitrary-frame authoring UI. Representable single-joint/vehicle rigs now support edit/removal with preserved imported data. Play strafing is camera-relative in both views and locomotion modes; keyboard and touch regressions cover the corrected left/right directions.

Structured browser/CLI queries now cover submodel/current-selection scopes, conservative source bounds, candidate overlaps and actionable dependency/physical-transform diagnostics without WebGL. Verified connectivity remains unavailable pending connector coverage.

Nearby Play interaction now supports E/touch joint open/close and on-foot vehicle control using movement keys/joystick. Multiple active rigs now share the Play world. Contextual doors/sliders now animate on fixed ticks, support reversal and report blocked retries. Supported chassis/wheel vehicles now have conservative world/other-rig collision protection with persistent stop reasons and reverse retry; see [driving profile](docs/PLAY-VEHICLES.md). Follow-up: scene picking/line-of-sight, authored seats and collision-safe entry/exit, riding, articulated driving and dynamic collision response. These require an explicit simulation/authoring contract; the current vehicle action is labeled Control vehicle rather than Enter vehicle.
