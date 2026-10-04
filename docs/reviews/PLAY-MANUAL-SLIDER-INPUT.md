# Manual motion sliders: latest target, bounded motion

A rapid drag on the remote door slider previously called the instantaneous
`setMechanismJoint()` path for each Kinematic input event. On the actual House
60616a door, a single 0→90° request was refused at 0° with “This motion needs too
many safety checks. Try a nearer target or a slower control.” The same unchanged
runtime reached 90° through an animated 90°/s target in ordinary checked ticks.

`PlayMechanismControls.tsx` now sends animated targets in both physics modes,
using the existing 90°/s turning and 40 LDU/s sliding rates. A single animation-frame
slot retains the latest intended value from an input burst. The slider thumb
shows that intent immediately; the adjacent reading continues to show actual
accepted motion. When motion stops or is blocked, the thumb reflects the accepted
position. Switching controls, pausing or closing cancels any unsent input.

The runtime, public instantaneous positioning API, native controller, geometry,
collision guard and resource caps are unchanged. Animated targets continue to
respect actual holders, included world geometry and the player. This is manual
input scheduling, not a new source of motor power or a physical connection.

The focused production browser test uses the actual House and Café builds at
1440×1000 and 390×844. It sends rapid 0→90→0 bursts, checks latest-target acceptance
before physics advances, then completed opening and reopening without safety
budget errors. It also checks close-before-dispatch cancellation, unchanged source
bytes/inventory/occurrences and the existing 44 px slider target. A separate
actual 60616a/60596 hinge fixture stops at an included thin wall and succeeds after
an explicit source edit removes that wall; each Play session preserves its own
source exactly. Batched desktop/phone inspection retains the existing workshop
interface without adding controls or reducing canvas space.

Commands:

```sh
npm run build
BROWSER_WORKERS=1 npx playwright test -c .local/remote-slider.config.ts --project=main tests/browser/play-manual-slider.spec.ts
npx tsc -b
```

The local Playwright config uses its own production preview on port 4405.
SwiftShader browser evidence does not claim physical-phone frame rates.
