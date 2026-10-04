# Mechanism entry and grip controls: design handoff

This is an ordinary extension of the incumbent **Builder’s Workshop** Play
interface. `PRODUCT.md`, `DESIGN.md` and `.impeccable/design.json` remain unchanged.
The comparison covers reviewed mechanism setup/Try/Save, contextual native grip
actions, and the selected-system overview; it is not a whole-application approval.

## Incumbent system comparison

- **Palette and material:** setup reuses the warm paper entry sheet, white native
  fields, navy text and orange primary action. Grip actions occupy the existing
  paper remote-control sheet. The navy HUD, upstream header and Gallery/Play
  navigation remain consistent with the supplied captures. No palette, font,
  raster asset or new visual world is introduced.
- **Type:** control facts use the existing 13px body and 12px label roles; the
  remote sheet title uses the existing 17px title role. Part choices use plain
  catalogue or already-loaded pinned-source descriptions plus stable occurrence
  paths, with filenames secondary or fallback. This follows the Practical Type
  Rule without defining another type scale.
- **Actions and disclosure:** explicit setup suppresses ordinary Enter Play and
  unrelated explorer onboarding. Try in Play is primary; Save mechanism to build
  is separate and secondary. Back to Play settings restores ordinary entry.
  Fixed/moving groups, review limits, motor settings and linked outputs use native
  disclosures. This follows the Action Accent and Model Space rules.
- **Grip actions:** Dynamic reports expose Grab for a candidate and Release for a
  held group inside the same sheet. Multiple candidates get a native selector;
  empty zones and Kinematic sessions add no grip actions. Native gripper reports
  also admit rigs without independent motor joints to Remote controls. That
  routing change adds no styling or extra canvas panel.
- **Model space and reach:** wide/landscape controls stay at the right; upright
  phones use the existing bounded bottom sheet. Fit build, orbit and zoom apply
  to the selected system and its currently held foreign group. Unrelated loose
  groups remain outside those bounds. Explorer movement waits during control.
  The new setup rows/disclosures/fields and grip actions retain the 44px target
  floor. Short screens disclose lower motor controls by scrolling and show the
  existing conditional scroll cue.

Source comparison sampled `PlayPanel.tsx`, `PlayMechanismSetup.tsx`,
`PlayMechanismControls.tsx`, `PlayGripperControls.tsx`, `play.css`, `tokens.css`,
and `src/play/mechanism-view.ts`, against the incumbent product, design and
sidecar files. These are task-local component behaviors, not new global tokens.

## Review and verification boundaries

- The proposal finish review initially requested three fixes: one setup entry
  action, understandable part identities, and removal of unrelated onboarding.
  Its subsequent **ship** verdict resolves only those three fixes. All twelve
  review/playing recaptures were inspected by that reviewer at 1440×1000,
  1080×1800, 360×600, 411×685, 390×844 and 686×411. Fixed-part rows were not
  expanded in those recaptures; their identity treatment is source evidence.
- The fresh grip reviewer’s parent-mailbox verdict is **ship**, with no material
  fixes, for authored contextual Grab/Release and held foreign-payload overview
  across the six required holding captures. Its accepted scope is an authored
  ideal attachment, excluding automatic jaw recognition and finger friction.
  This verdict is separate from the proposal fix verdict and rack acceptance.
- Child grip packet `grip-review-3e7467d` seals six holding images and six fit
  records. This documentation pass rechecked all twelve hashes: all match.
  Every fit record contains 32 selected-and-held corners inside its unobscured
  rectangle (192 total); every recorded grip action is 44px tall.
- The additional `grip-only-review-232ac89` packet seals the 390×844 holding image,
  layout record and four verification logs; all six hashes match. Its grip-only
  action measures 334×44px. Two child integration cases passed: gripper-only
  access/empty-zone close/Kinematic absence, and authored-held → unsaved Dynamic
  spur replacement, including cleared old grips/bounds and preserved source,
  native project and inventory. This route has one viewport capture, not six.
- This documentation pass opened six existing images: proposal review at
  1440×1000 and 360×600, proposal playing at 686×411, grip holding at 1080×1800
  and 360×600, and grip-only holding at 390×844. All twelve proposal PNG dimensions
  also match their named viewports. No new browser run, detector run or polish
  cycle was performed.
- Child proposal evidence records eight passing production browser cases and
  19 accepted focused unit cases, with source-preserving Try/Save/undo, native and
  inventory checks. Child grip evidence records six passing browser cases and
  35 distinct focused unit cases. These sets overlap and are not additive.
  Parent integration separately reports 44 focused tests across seven files
  passing in 33.63s. The parent combined `npm run build` completes successfully,
  including schema regeneration and TypeScript; Vite takes 46.98s. The Rapier
  marker remains confined to lazy `session-Dg0UUR_U.js` and is absent from the
  main application chunk. Parent browser integration is recorded separately in
  `docs/VERIFICATION.md`.

The proposal direction packet and committed implementation evidence are at
`.impeccable/review/proposal-entry/packet.md` in the proposal child worktree and
[`MECHANICAL-PROPOSAL-ENTRY.md`](MECHANICAL-PROPOSAL-ENTRY.md). Its bounded finish
review/verdict are retained privately in the parent review directory. Grip
manifests and capture records remain in the child’s private `.local/` directories;
they are verification artifacts, not shipping assets.

## Existing drift left unchanged

The older `.impeccable/surfaces/src-ui-app-tsx.md` brief still describes green/gold
materials; the incumbent cream workshop source and `DESIGN.md` are authoritative.
The sidecar lists a 650px HUD breakpoint but does not separately represent the
existing 1100px tablet HUD threshold documented in `DESIGN.md` and implemented in
`hud.css`. The supplied proposal detector also reports two inherited 17px radius
advisories in `play.css`. None is repaired or promoted into a new system rule by
this ordinary-extension handoff. Still captures do not independently certify
motion, keyboard focus, unpictured error states or physical rack contacts.
