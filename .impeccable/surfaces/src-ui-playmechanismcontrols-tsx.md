---
version: 1
slug: "src-ui-playmechanismcontrols-tsx"
primary_target: "src/ui/PlayMechanismControls.tsx"
related_targets:
  [
    "src/ui/PlayPanel.tsx",
    "src/ui/play.css",
    "src/ui/play-motor-presentation.ts",
    "src/catalog/motion-samples.ts",
    "src/catalog/motion-sample-specs.ts",
    "src/catalog/template-names.ts",
  ]
---

# Surface brief: Play mechanism controls

Scope: the existing Play mechanism overview, control sheet and certified-vehicle driving transition on desktop and phones, plus the public Large motor sample entry. Visitor mode: Operate.
Audience and job: hobbyists and children inspect a complete Technic mechanism, choose an available motor or moving part, understand what their input moves, and drive an available vehicle.
Action and proof: show available controls directly in active Play; run independent motors with visible power, direction and simulated state; keep the complete mechanism in the clear canvas area. Get in controls the vehicle as a whole in third person, with Get out reachable. Saved settings and linked output details remain disclosures.
Constraints: inherit the current cream workshop DESIGN.md and tokens, navy HUD and burnt-orange actions; preserve 44px targets, safe-area spacing, local assets and existing explorer transitions. This is a scoped extension, with no new visual world or palette.

## Direction contract

THESIS: The complete mechanism remains visible while its usable controls sit beside or below the canvas.

OWN-WORLD: Inherit DESIGN.md: cream paper controls, navy HUD, burnt-orange active direction and warm pressed motor tabs. Preserve current type, corners, focus rings and touch sizing.

STORY: Open Controls, orbit the mechanism, choose a motor, set Power and tap Forward or Reverse. Independent motors keep running when switching tabs; Brake or Brake all stops them. Get in switches an available certified vehicle to driving; Get out returns the explorer beside its current location.

FIRST VIEWPORT: Desktop and tablet place a compact control sheet at the right; upright phones place it at the bottom. Fit build and Close stay in the header. Orbit guidance and motor tabs with live status remain outside the scrolling body; Power and direction lead that body. Short landscape hides the orbit caption. Secondary settings and outputs scroll below; the clear canvas fits the whole rig. Driving keeps the model visible with the vertical throttle pad at bottom left, the horizontal steering pad at bottom right, and Get out separated above steering.

FORM: Extend the existing Play overview and paper sheet. Inherit the established workshop direction; no direction roll or new seed applies to this scoped extension.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Current interaction

Motor presentation describes the simulated state with plain labels: Motor off, Motor stalled, At limit, Braking, Holding, Running forward, Running reverse or Running on its own. Power is a percentage, and motor state replaces accumulating shaft-angle counters. Manual moving parts retain their position reading and slider.

Before entering Play, source-bound large motors undergo a connection review against the current project. The entry settings show Checking motor connections… while that review is pending, and Enter Play remains disabled during the review, model opening/loading and world preparation. Rigs with reported source or physical eligibility errors are omitted from the usable choices; Connections need review discloses their reasons. These are entry safeguards, not a claim that every source mechanism has been admitted or physically verified.

The public chooser names the sample Large motor and uses its local preview. Its hint says Open Controls. Change power and direction to turn the red axle. The sample requests Dynamic physics by default; the Mechanism physics disclosure keeps Dynamic and Kinematic choices available and explains that simulated masses and forces are not real brick strength. The control sheet uses the authored rig name, Pin-mounted Power Functions L motor, clamped to two lines where needed. The supplied Large motor captures show 50% Power and Running forward; the complete chooser and loading/review states are not pictured.

When all available controls are motors, each tab shows its own live status and selected state. These tabs, the header and the orbit caption remain outside the scrolling control body. The selected motor's name and status are not repeated below its tab. Mixed manual controls retain the Part control select. The sheet shows a scroll cue only while controls remain below the visible body. At viewport heights up to 500px the orbit caption is hidden so the primary Power and Reverse / Brake / Forward controls remain together.

Power changes speed and bounded native motor effort in Dynamic mode. Zero Power retains the chosen direction; Brake clears it. Pausing or window blur stops live inputs. Closing the sheet brakes enabled motors in the current rig, clears live inputs and restores exploration. The rig and orbit survive pause. Availability comes from the active rig reports, with one driver per transmission and passive loop joints omitted.

Get in for an available certified vehicle controls the whole build and selects a third-person vehicle view. The explorer is hidden, its collider is disabled, and its native physics actor is made non-solid while driving. Separate throttle and steering pads, or movement keys, drive and steer; dragging orbits the vehicle. Get out searches for a clear supported standing point beside the vehicle's current location and restores exploration. If every exit is blocked, driving continues with an actionable message to move to a clear space. This transition does not invent a physical seat attachment.

The pause menu says Resume driving while in a vehicle and explains driving, orbiting and the nearby exit. Recover last safe position is hidden while driving or controlling a mechanism, where that explorer action is unavailable.

## Asset provenance

The shipping sample preview `public/templates/twin-drive.webp` is generated by the app's own renderer through `scripts/build-templates.ts` from the original CC0 parts arrangement in `src/mechanisms/twin-drive-fixture.ts`. It is a rendered sample, with no AI image asset. LDraw parts retain their own library licensing.

The new shipping preview `public/templates/large-motor.webp` is likewise generated by `scripts/build-templates.ts` with the app renderer and its recorded camera, from `fixtures/ldraw/templates/large-motor.mpd`. Its original CC0 arrangement comes from `src/mechanisms/pf-large-motor-fixture.ts`; the pinned original LDraw geometry retains its own licensing. The adjacent `public/templates/large-motor.webp.json` records this provenance and that no AI image generation was used. The supplied `.local/root-large-motor-provenance.log` records 16 rasters and zero missing provenance records.

## Evidence and review boundary

Current screenshot evidence is all fourteen captures under `.impeccable/review/`: `desktop.png` and `mobile.png` show Large motor running forward at 1440×1000 and 360×600; `motor-{size}.png` and `driving-{size}.png` cover 1440×1000, 1080×1800, 360×600, 411×685, 390×844 and 686×411. The motor pairs show Twin motor table with Motor 1 Running forward and Motor 2 Running on its own; the driving pairs show Roadster in third person with separate throttle and steering pads and Get out reachable above steering. Capture provenance places these at production build `b1c390b`, rebased onto `origin/main` `9250c06`. Later test/document work does not extend the pictured acceptance; unpictured vehicle and winch mechanics remain work in progress.

The six production confirmation cases in `.local/root-play-design-proof.spec.ts` passed in 2.7 minutes, recorded in `.local/root-main925-play-design-production.log`. They check the live motor label; hidden explorer joystick and driving pads during mechanism control; visible motor tabs and a direction button with at least 44px targets; third-person vehicle control with a hidden explorer; both driving pads inside the viewport with at least 44px targets; Get out inside the viewport with a 44px target and no pad overlap; successful exit; and no page errors. The integrated production build in `.local/root-main925-integrated-build.log` passed schema generation, TypeScript and Vite; Vite completed in 56.90 seconds.

The two desktop/phone Large motor production cases in `tests/browser/play-large-motor.spec.ts` passed in 38.4 seconds (`.local/root-main925-large-motor-confirmation.log`). They confirm Dynamic default, movement of the actual source rotor with a stationary casing/carrier, Forward and Reverse, zero Power and direction resumption, and unchanged source export, query and native document contents after exit. These focused checks support this sample's behavior without accepting unrelated mechanics. The supplied manual entry-interface detector result in `.local/root-reviewed-entry-ui-detector.json` is `[]`; it applies to the root PlayPanel changes before the `9250c06` rebase. This documentation handoff did not rerun context, detectors, browser tests or QA.

The fresh independent reviewer opened all fourteen captures and sampled current source, returning SHIP at the Play UI and Large motor sample scope in `.local/main925-play-ui-finish-review.md`. Its five sections are persistence, fidelity, ceiling, material_fixes and keep; no material UI fixes remain. This current evidence and verdict replace the historical surface-brief proof. They do not accept or release the full mechanical systems. Keyboard and screen-reader behavior, blocked-exit recovery, long-label variants beyond those shown, every motor state, unpictured entry/loading states, complete chooser composition, and every source mechanism's physical correctness or admission remain outside this review boundary. The supplied production checks supplement the visual review; they do not claim a full browser-suite pass. The broader native-mechanics goal remains incomplete and has not been pushed to main.

Documentation sampled the current Large motor desktop and phone captures, the 360×600 twin-motor capture and the 686×411 driving capture, together with the supplied review, logs, sample metadata and preview provenance. It compared `PlayMechanismControls.tsx`, `play-motor-presentation.ts`, `PlayPanel.tsx` and `play.css` against `PRODUCT.md`, token-bearing `DESIGN.md`, `.impeccable/design.json` and `tokens.css`. The build reuses cream paper, navy HUD, burnt-orange actions, warm pressed tabs, established type and corners, and the 44px target floor. This ordinary extension preserves the incumbent product and design system files; its interaction details belong in this surface brief. No new visual world, seed or approved composition is introduced.

The older App surface brief still describes a navy/green/gold world. That preexisting drift is outside this extension; current DESIGN.md, tokens and rendered Play controls are the visual authority for this surface.
