---
name: "Brick Editor"
description: "A warm cream workshop for real brick models."
colors:
  paper: "#faf7f1"
  chalk: "#faf7f1"
  card: "#ffffff"
  ink: "#202a3c"
  secondary: "#62645f"
  line: "#dedbd2"
  tab-well: "#eee8dd"
  sheet-handle: "#c9c4b8"
  scene: "#dfe6ea"
  hud: "rgba(32, 42, 60, 0.96)"
  hud-hover: "#344157"
  hud-line: "rgba(244, 241, 234, 0.16)"
  hud-mute: "#b9c0cf"
  scrim: "rgba(29, 34, 48, 0.4)"
  accent: "#bd481e"
  accent-deep: "#9d3715"
  grass: "#f8e1d4"
  grass-ink: "#913b1c"
  sun: "#bd481e"
  sun-wash: "rgba(189, 72, 30, 0.14)"
  amber: "#b7791f"
  caution-wash: "#fbf4e9"
  caution-line: "#f3dcb9"
  caution-ink: "#714b13"
  danger: "#a74c20"
  peach: "#f2e2d5"
  sage: "#e6eadb"
  sand: "#f1e9da"
  nav-recess: "#141e30"
  secondary-action: "#ede7dc"
  prompt-ground: "#f0ece3"
  tool-hover: "#f0e6d7"
typography:
  display:
    fontFamily: '"Bricolage Grotesque", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "43px"
    fontWeight: 750
    lineHeight: 1.12
    letterSpacing: "-0.03em"
  detail-headline:
    fontFamily: '"Bricolage Grotesque", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "54px"
    fontWeight: 750
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  model-title:
    fontFamily: '"Bricolage Grotesque", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "22px"
    fontWeight: 550
    letterSpacing: "-0.7px"
  headline-large:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "25px"
    fontWeight: 550
    letterSpacing: "-0.7px"
  display-phone:
    fontFamily: '"Bricolage Grotesque", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "29px"
    fontWeight: 750
    lineHeight: 1.12
    letterSpacing: "-0.03em"
  detail-headline-phone:
    fontFamily: '"Bricolage Grotesque", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "35px"
    fontWeight: 750
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  body:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "13px"
    fontWeight: 400
  label:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "12px"
  field-touch:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "16px"
  sheet-title:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "17px"
    fontWeight: 700
rounded:
  field: "8px"
  key: "10px"
  card: "12px"
  slab: "14px"
  dock: "16px"
  sheet: "18px"
  badge: "6px"
  menu-tab: "9px"
spacing:
  tight: "4px"
  small: "8px"
  control: "12px"
  gutter-phone: "16px"
  sheet: "18px"
  section: "24px"
  gutter-desktop: "36px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.card}"
    rounded: "{rounded.key}"
    padding: "0 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.accent-deep}"
  button-secondary:
    backgroundColor: "{colors.secondary-action}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "9px 13px"
    height: "44px"
  button-hud:
    backgroundColor: "{colors.hud}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.slab}"
    height: "48px"
    padding: "0 16px"
  mode-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    height: "44px"
    padding: "0 20px"
  angle-active:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    height: "44px"
    padding: "0 14px"
  field:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    height: "44px"
    padding: "9px 10px"
  prompt-select:
    backgroundColor: "{colors.tab-well}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    height: "44px"
    padding: "9px 10px"
  effort-badge:
    backgroundColor: "{colors.grass}"
    textColor: "{colors.grass-ink}"
    rounded: "{rounded.field}"
    padding: "6px 10px"
    typography: "{typography.label}"
  filter-chip-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.sheet}"
    padding: "0 12px"
  model-stage:
    backgroundColor: "{colors.sand}"
    rounded: "{rounded.dock}"
  part-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "6px 6px 7px"
  model-tools:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.dock}"
    padding: "22px"
    width: "360px"
  play-settings-tab-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.chalk}"
    typography: "{typography.label}"
    rounded: "{rounded.menu-tab}"
    padding: "8px"
    height: "48px"
---

# Design System: Brick Editor

## Overview

**Creative North Star: "The Builder’s Workshop"**

Warm paper, expressive headings and quietly coloured model stages make builds feel close enough to handle. Deep navy carries navigation and floating controls; burnt orange marks actions and focus. The model remains the largest visual surface, with supporting facts and attribution set in practical, legible type.

The cream ground is the approved production identity. Gallery gives models room to be compared, while the editor and Play keep useful controls compact around the live scene. The product name remains brickeditor. New surfaces share these materials and type roles without copying any one screen’s composition.

**Key Characteristics:**

- Warm paper with navy control surfaces and burnt-orange actions.
- Locally hosted expressive headings and practical system body text.
- Broad peach, sage and sand stages with factual, compact model labels.
- Phone layouts that preserve the model and reachable controls.

## Colors

The frontmatter records the actual palette from `src/ui/tokens.css` and reused workshop surfaces in `src/ui/workshop.css`; these are production values. CSS remains the implementation source of truth.

### Primary

- **Burnt orange:** primary actions and focus, with a deeper hover state.
- **Warm pressed peach and dark clay:** selected tool wells and effort badges. The compatibility names `grass` and `grass-ink` now describe these warm colours; `sun` aliases the action orange and `sun-wash` its translucent state wash.

### Secondary

- **Peach, sage and sand:** broad alternate grounds for model stages. They separate neighbouring images without implying different agents.

### Neutral

- **Warm paper / chalk:** the cream page ground, content sheets and active navigation. Both names share the same value.
- **White card:** fields, selected angle tabs, prompt tabs and part cards.
- **Navy ink:** primary text and header. Translucent navy HUD slabs float over the scene; recessed, hover and muted tones support their states.
- **Stone text, pale line and tab well:** supporting copy, borders and recessed controls. Secondary action, prompt ground and tool hover are reused warm surface tones.
- **Scene, scrim and sheet handle:** cool canvas ground, modal dimming and sheet affordances. Model colours are independent of interface tokens.

The sidecar’s tonal ramps are synthesized preview strips derived from these colours, not additional production tokens.

Amber marks favourites; caution wash, line and ink carry notices. Clay danger remains reserved for destructive or risky actions with an explicit label.

**The Action Accent Rule.** Use burnt orange for actions, focus and concise state indicators; let model geometry supply the richest colour.

## Typography

**Display Font:** Bricolage Grotesque, falling back to the body stack.
**Body Font:** the platform system sans-serif stack, including Segoe UI and Roboto.

Bricolage Grotesque is bundled locally as a variable font with weights 200–800, `font-display: swap` and its OFL notice. It gives headings, the wordmark and short dock titles a friendly, solid character. Controls and detailed text use the practical body face. Numerals are tabular throughout.

The default body is **13px**, with **12px** labels. General paragraphs use a 1.65 line height; Gallery descriptions use 1.5 and compact metadata has its own 1.3–1.6 rhythm. Do not infer one global paragraph line height from a single component.

The recorded hierarchy includes Gallery display (43px), detail headline (54px), model title (24px), existing sheet title (17px), and dialog headline steps (22px / 25px). Gallery display becomes 29px and detail headline 35px at phone width. Short phones use a 25px Gallery display and 22px model title. Touch fields use the existing 16px role where the field rules apply. The implemented shell also uses 18px context titles, 21px Play dock titles, a 26px tools title and smaller 11px compact phone metadata; these are local role adjustments, not a new universal scale. Reuse the nearest established role when adding screens.

**The Practical Type Rule.** Use the display face for headings and short model names; keep facts, instructions, fields and controls in the system body face.

## Layout

The navy header is 78px tall plus the top safe-area inset. Gallery is a scrollable paper surface below it; editor and Play place the live canvas below the same header. Navigation remains Gallery and Play, with Build, Instructions, Photo and Project in the model tools menu.

Gallery’s outer container has a 1640px maximum width and 36px horizontal padding, with three columns, 24px column gaps and 38px row gaps. At widths up to 1100px it uses 24px gutters and two columns. A prompt answered by two models is a pair in two columns at every width above 760px; detail pairs an image column with a narrower facts column.

At widths up to 760px the header becomes 68px, gutters become 16px and the prompt rail becomes a native select. A two-model pair and the detail page stack vertically; a prompt with more responses forms a horizontal snapping strip with a 14px gap and `calc(100vw - 68px)` response width, leaving the next response visible. The model note sits above full-width angle tabs. Gallery stages change from a 1.29 to a 1.55 aspect ratio. The file action moves into the Gallery controls; navigation remains visible.

The 380px rule trims navigation padding. Short phones (height up to 650px) reduce headings. Landscape (height up to 500px and width at least 500px) uses a 60px header and compact dock positions. Model tools panels scroll within available viewport height rather than extending beyond it. In short phone and tablet landscape, active Build placement temporarily hides the model context and editing header actions, brings the native toolbar beneath the primary header and lets the placement card scroll within the remaining height. Primary navigation stays reachable.

Existing editor HUD layout keeps its own phone / tablet threshold at 1100px and narrow-phone threshold at 650px. Do not collapse those into the Gallery’s 760px breakpoint. HUD slots use shared safe-area tokens and edge offsets of at least 12px. Desktop sheets float beside the model; touch sheets rise from the bottom. Phone Build puts the model heading and Tools action in one compact row, truncating long visible titles while keeping their full text in the DOM. On phones and tablets, opening a Build sheet temporarily hides the model context and editing header actions; Gallery and Play navigation remains visible. The expanded sheet takes the reclaimed height and the status message moves below the site header. Toolbars, mode cards and open sheets use the remaining viewport height as a bound so growing placement controls stay reachable. The ordinary target floor is 44px, with 46px tool keys and 48px hotbar keys. Small desktop filter chips expand for touch.

**The Model Space Rule.** Reduce secondary chrome and disclose tools progressively before reducing the model area or touch targets.

## Elevation & Depth

Stages get depth from tonal grounds and the model image, without a shadow around each complete response. Primary Gallery buttons and selected tabs have small diffuse shadows. Menus and Play docks float above the scene with stronger, navy-tinted ambient shadows. The four shared HUD depth tokens are slab, dock, sheet and rising sheet; their exact values and representative workshop shadows are in the sidecar.

Primary Gallery buttons lift 1px on hover and press down 2px on activation over 180ms. Existing HUD elements fade to 0.18 opacity and become click-through while the canvas is dragged, then return after release. Active Play removes the editing HUD and provides its own controls. Reduced-motion preference removes workshop transitions, animation and smooth scrolling.

## Shapes

The shared radius vocabulary progresses from field (8px) and key (10px), through card (12px) and slab (14px), to dock (16px) and sheet (18px). Compact prompt count badges use 6px. Gallery stages use 16px corners, reducing to 14px on phones; menus use 16px. Native circular walking controls remain circles.

Borders define fields, part choices and disclosures rather than surrounding every section. Header and model controls can use borderless slabs. Gallery preview images multiply against their pastel stage grounds; the detail page's live 3D view multiplies the same way and fades in over its picture. Icons use the authored 24px viewbox, 2px stroke and round caps and joins; disclosure chevrons are drawn in CSS.

## Components

### Buttons

Orange commits with white text; deeper orange marks hover. Gallery response actions use 44px targets, 10px corners and bold 13px body text. Main detail exploration and Play entry actions are taller. Secondary model tool actions use a warm neutral fill; ordinary sheet buttons use white and a pale border. Navy slab buttons retain the existing HUD vocabulary with current warm tokens. Disabled buttons use 0.4 opacity and a blocked cursor.

Focus is a 3px orange outline with **2px offset**, shared by buttons, inputs, selects, links and disclosure summaries. Icon-only actions retain an accessible name and at least a 44px hit area.

### Inputs / Fields

White fields use a pale border, 8px corners, 9px by 10px padding and a 44px minimum height. The phone prompt select swaps white for the warm tab well and removes the border. Keep native selection behavior and an explicit accessible name. Checkboxes and ranges use the orange accent within a reachable labeled control.

### Navigation

Gallery and Play sit in a recessed navy switch with 12px outer and 8px inner corners. The selected button uses paper and navy ink, communicated with `aria-pressed`; other buttons remain on navy. Hover uses the HUD hover tone; selected hover uses the secondary action surface. Phones reduce padding before target height.

### Tabs / Chips

Shared angle tabs sit in the warm tab well with 10px outer corners and 4px padding. The selected angle uses white, navy bold text and a small diffuse shadow. All visible models share the selected angle. Existing sheet filter chips invert to navy with paper text when pressed. Effort badges use peach with dark clay text, with factual labels rather than decorative status. Play settings use their own three-column equal tab grid with 4px gaps, 48px minimum-height buttons, 8px padding and 12px labels that can wrap. These tabs retain the existing warm well and navy selected state; this scoped arrangement keeps long labels separated on narrow phones.

### Cards / Containers

Gallery responses are open groups: a large pastel stage, image, source label, display title, short description, part count and actions. Their whole container has no raised card outline. Part cards inside sheets are white with pale 2px borders and 12px corners; selected borders use the warm peach compatibility token and a clay check. These are distinct component roles.

### Model Tools and Play

The paper tools panel groups the four model views in full-width rows with peach icon wells and orange art. Desktop width is 360px with 22px padding; phones fit the viewport inside safe-area edges with 18px padding and scroll. Phone menus anchor to the right and retain that usable width even when their opener is compact, including during active Play. A native disclosure reveals source notes. The navy Play entry dock pairs a display title with a primary walking action and an icon-only settings button; at phone width secondary prose recedes. Play settings use a height-bounded panel above the entry dock, keeping Enter Play reachable on phones and in landscape. During active Play, the engine’s walking and vehicle controls remain the operative interface.

**Remote mechanism controls:** a direct Controls action appears in the active Play HUD only when a usable mechanism is available; the pause menu also provides access. A compact paper sheet sits at right on wide/landscape screens and at the bottom on upright phones. Fit build stays in the sheet header; live group bounds fit into the clear canvas area below the status slab and beside or above the sheet, with drag-to-orbit and pinch/scroll zoom for closer inspection. Fit restores the whole system after zooming. The status slab leaves room for Tools without shrinking Pause. Explorer movement and unrelated actions wait while controlling. Offer one driver per transmission, exclude passive loop joints, and show only usable rig controls.

Motor controls put Power (0–100%), Reverse, Brake and Forward first. Direction stays running after a tap; raising Power from zero restores the chosen direction until Brake clears it. Power limits turning speed and, in Dynamic mode, available motor force within the motor's native effort limit. Independent motor tabs show each motor's state and preserve the other motors' live inputs; Brake all stops the rig's motors when another motor is active. Manual parts keep their position slider. Motor settings, saved presets and linked outputs fold away, and a scroll cue appears only when more controls remain below the sheet. Keep control targets at least 44px. Pause or window blur stops live inputs while retaining the selected rig and orbit for resumption. Closing brakes the current rig's enabled motors, clears live inputs and restores the explorer view. Successful vehicle, seat or train transitions end the overview; failed transitions retain it.

## Do's and Don'ts

### Do:

- **Do** keep warm paper as the application ground and navy as the control material.
- **Do** give models more area than supporting controls and metadata.
- **Do** use the existing orange focus ring and preserve accessible labels when visible text disappears.
- **Do** keep touch targets at least 44px and respect safe-area insets and reduced motion.
- **Do** use same-origin assets, the self-hosted display font and the authored SVG icon family.
- **Do** distinguish actual responses, source facts and placeholders with plain labels.

### Don't:

- **Don’t** restore green or gold through the legacy grass and sun token names; their current values are warm peach and orange.
- **Don’t** make stage colour an agent identity or an interaction state.
- **Don’t** wrap every gallery response in a raised, bordered card.
- **Don’t** hide an essential action behind hover alone or shrink touch controls to fit.
- **Don’t** imitate LEGO logos, wordmarks or trade dress.
- **Don’t** load remote fonts or hotlinked images.
