---
name: Brick Editor
description: A creative-mode HUD laid over a full-bleed 3D build; navy control slabs, chalk inventory sheets, grass for the tool in hand.
colors:
  ink-navy: "#1d2230"
  hud-slab: "rgba(29, 34, 48, 0.92)"
  hud-slab-hover: "#2a3044"
  hud-line: "rgba(244, 241, 234, 0.16)"
  chalk: "#f4f1ea"
  hud-mute: "#b9c0cf"
  slate-secondary: "#4f5a6e"
  sheet-line: "#e2dccf"
  tab-well: "#e9e4d8"
  sheet-handle: "#c9c4b8"
  card-white: "#ffffff"
  scene-haze: "#dfe6ea"
  commit-grass: "#2e7d43"
  commit-grass-deep: "#266a38"
  lit-grass: "#5bb56a"
  lit-grass-ink: "#10240f"
  sun-gold: "#ffd166"
  favourite-amber: "#b7791f"
  caution-wash: "#fbf4e9"
  caution-line: "#f3dcb9"
  caution-ink: "#714b13"
  danger-rust: "#a74c20"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "43px"
    fontWeight: 550
    lineHeight: 1.15
    letterSpacing: "-1.8px"
  headline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "22px"
    fontWeight: 550
    lineHeight: 1.25
  headline-large:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "25px"
    fontWeight: 550
    lineHeight: 1.25
    letterSpacing: "-0.7px"
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 700
  hud-label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 650
    fontFeature: "tnum"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    fontFeature: "tnum"
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    fontFeature: "tnum"
  field-touch:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 400
rounded:
  field: "8px"
  key: "10px"
  card: "12px"
  slab: "14px"
  dock: "16px"
  sheet: "18px"
  pill: "17px"
spacing:
  hair: "2px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  edge: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.commit-grass}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.slab}"
    padding: "0 16px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.commit-grass-deep}"
  hud-slab-button:
    backgroundColor: "{colors.hud-slab}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.slab}"
    padding: "0 16px"
    height: "48px"
  hud-slab-button-hover:
    backgroundColor: "{colors.hud-slab-hover}"
  mode-tab:
    textColor: "{colors.hud-mute}"
    typography: "{typography.hud-label}"
    rounded: "{rounded.key}"
    padding: "0 12px"
    height: "40px"
  mode-tab-active:
    backgroundColor: "{colors.chalk}"
    textColor: "{colors.ink-navy}"
  tool-button:
    textColor: "{colors.chalk}"
    typography: "{typography.hud-label}"
    rounded: "{rounded.key}"
    padding: "0 12px"
    height: "44px"
  tool-button-active:
    backgroundColor: "{colors.lit-grass}"
    textColor: "{colors.lit-grass-ink}"
  tool-button-touch:
    size: "46px"
  hotbar-slot:
    textColor: "{colors.chalk}"
    typography: "{typography.label}"
    rounded: "{rounded.key}"
    height: "48px"
  status-toast:
    backgroundColor: "{colors.hud-slab}"
    textColor: "{colors.chalk}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "34px"
  sheet:
    backgroundColor: "{colors.chalk}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.dock}"
    padding: "18px 16px"
  part-card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.card}"
  filter-chip-active:
    backgroundColor: "{colors.ink-navy}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.sheet}"
    height: "44px"
  segmented-tab-active:
    backgroundColor: "{colors.ink-navy}"
    textColor: "{colors.chalk}"
    rounded: "9px"
    height: "40px"
---

# Design System: Brick Editor

## Overview

**Creative North Star: "The Creative-Mode HUD"**

The build is the world and the interface is a heads-up display laid over it. The 3D canvas fills the whole viewport at every size; there is no header, sidebar frame or status bar boxing it in. Controls live in slots pinned to the screen edges (mode switcher and project top left, save and export top right, a tool dock at the bottom centre on desktop or a right-edge thumb column on touch, a hotbar along the bottom on touch), and the whole HUD dims to near-transparent and click-through while a finger or pointer drags on the model.

Two materials carry everything. Controls are deep ink-navy slabs at high opacity with crisp 2px chalk-tinted outlines and chalk text. Content (parts inventory, layers, inspector, mode cards, welcome) sits on chalk inventory sheets with navy ink. Colour is spent on state, not decoration: grass lights the tool you are holding, a darker grass commits, sun gold rings what is focused or held. Type is the platform system sans, set bold for HUD labels with tabular numerals so part counts never jitter.

The mood is playful and sturdy without being toy trade dress or a cold CAD cockpit. Density is low on touch (44–48px keys) and moderate on desktop, where the parts inventory and properties dock as floating chalk sheets beside the model rather than framing it.

**Key Characteristics:**

- Full-bleed canvas; every control floats in an edge slot, 12px from the viewport edge.
- Navy HUD slabs (controls) and chalk sheets (content): two materials, never mixed on one surface.
- Grass marks the tool in hand; darker grass commits; sun gold rings focus and the held hotbar slot.
- Authored 24px, 2px-stroke, round-cap SVG icons; drawn disclosure chevrons.
- System sans, bold HUD labels, tabular numerals throughout.
- The HUD recedes while you work the model and steps aside entirely in active Play.

## Colors

A night-navy and chalk pairing with two state colours, grass and sun, laid over a pale blue-grey scene haze.

### Primary

- **Commit Grass** (commit-grass): the only filled button colour for commits: Export, Place selected part, Explore the studio template. It is a darker grass than the lit tool so white text passes contrast; hover deepens to Commit Grass Deep. Also the ink for small success text on chalk (Offline tag, part check, library note icons).
- **Lit Grass** (lit-grass): the tool currently in hand in the tool dock, the chosen part-card outline, the save dot, and the save icon on the phone save chip. Always carries Lit Grass Ink text, never white.

### Secondary

- **Sun Gold** (sun-gold): the 3px focus ring on every interactive element, the ring and 12–14% gold wash on the selected or active hotbar slot, and the text-selection highlight. It rings and outlines; it is not a panel fill.

### Tertiary

- **Favourite Amber** (favourite-amber): the pressed favourite star on part cards. Nothing else.
- **Caution** (caution-wash, caution-line, caution-ink): drawn from the Favourite Amber ramp for notices that need attention but are not errors: save conflicts, import diagnostics, resource warnings, replace warnings. Wash fills, line outlines, ink carries the text.
- **Danger Rust** (danger-rust): destructive actions (remove a layer, delete a saved project) as text, and the fill of an armed risk confirmation with white text. Nothing else.

### Neutral

- **Ink Navy** (ink-navy): body ink on chalk sheets; the fill of pressed filter chips and the active Layers/Inspector segment.
- **HUD Slab** (hud-slab): 92% navy for every floating control surface: mode strip, project slab, save slab, tool dock, view strip, status toast, counts chip, hotbar. Hover on slab buttons lifts to HUD Slab Hover.
- **HUD Line** (hud-line): the 2px outline on slabs and the dividers between tool segments.
- **Chalk** (chalk): text and icons on navy; the ground of every content sheet; the active mode tab fill.
- **HUD Mute** (hud-mute): inactive mode tabs, secondary HUD text (save state, brand prefix, grid state).
- **Slate Secondary** (slate-secondary): secondary text on chalk (inactive segment tabs, the mode-chip chevron).
- **Sheet Line** (sheet-line): 2px part-card borders and hairlines on chalk. **Tab Well** (tab-well): the recessed track behind segmented tabs. **Sheet Handle** (sheet-handle): the 44×5px grab bar on touch sheets.
- **Card White** (card-white): part cards, search and form fields on chalk sheets.
- **Scene Haze** (scene-haze): the canvas ground behind the model and the app background.

### Named Rules

**The Lit Slot Rule.** Lit Grass means "the tool you are holding" and nothing else on the HUD. It always takes dark Lit Grass Ink text; white on Lit Grass fails contrast.

**The Commit Grass Rule.** Anything that commits (export, place, start) is Commit Grass with white text. One commit per slot group; everything else on navy is a slab button.

**The Gold Ring Rule.** Sun Gold is a ring, not a fill: focus outlines (3px, 2px offset) and the held hotbar slot's border. Its washes never exceed about 14% opacity.

## Typography

**Display Font:** system sans (ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif)
**Body Font:** the same stack
**Label/Mono Font:** the same stack with tabular numerals

**Character:** One sturdy platform sans, no webfont (strict CSP and a self-hosted-or-system constraint). Weight does the work: bold HUD labels read like game keys, regular body text stays quiet inside sheets.

### Hierarchy

- **Display** (550, 43px, 1.15, -1.8px): the empty-canvas welcome headline only.
- **Headline** (550, 22px on touch sheets, 1.25): mode-card and dialog titles on touch; export stat figures.
- **Headline Large** (550, 25px, 1.25, -0.7px): desktop mode-card and dialog titles.
- **Title** (700, 17px): touch sheet heads (Parts, Layers, Inspector); 13px 700 for section headings inside sheets (Starter collection).
- **HUD Label** (600–650, 13px, tabular): mode tabs, tool dock, slab buttons, project name. The brand's second word and emphasis go to 750.
- **Body** (400, 13px, tabular): sheet content and help text.
- **Label** (600, 12px, tabular): status toast, counts chip, view strip, hotbar slot names, save state. It is also the floor: no UI text is set below 12px.
- **Field Touch** (400, 16px): text inside inputs and selects on phones, so mobile browsers do not zoom on focus.

### Named Rules

**The Tabular Rule.** `font-variant-numeric: tabular-nums` is set on the body; part counts, selection counts and revision numbers never shift width as they change.

## Layout

The canvas is absolutely full-bleed (100dvh) at every width; the HUD is a pointer-transparent layer whose slots opt back into pointer events. Every slot sits 12px from the viewport edge (safe-area aware at top and bottom), and slots in a row are spaced 8px apart.

- **Desktop (>1100px):** top row of mode strip, project slab and, pushed right, save slab and Export. Parts inventory docks left (300px) and Layers/Inspector docks right (310px) as floating chalk sheets from 74px below the top to 90px above the bottom. The tool dock is centred at the bottom; camera views pop up from it on demand, and a single Fit view control stays in the dock. The counts chip sits bottom left. Between 1101px and 1400px the brand and save-state text drop out of the project slab.
- **Tablet (651–1100px):** tools move to a vertical thumb column on the right edge (46px icon keys, labels visually hidden but named). A 64px hotbar runs along the bottom, capped at 680px wide. Panels open as floating sheets at most 680px wide, rounded on all corners and inset from the left edge, so the model stays visible beside them in portrait; the tool column remains usable next to an open sheet. Header actions become icon-only 48px keys.
- **Phone (≤650px):** one top row: a mode chip (current mode icon, name and a drawn chevron) that opens the full five-mode list, with save chip and Export at top right; the project slab is hidden. Sheets span the full width, rise at about half height above the hotbar and extend to full height from the handle. The tool column hides while a sheet is open.
- **Rhythm:** 2px inside segmented groups, 4–6px inside docks, 8px between slots, 12px edge inset, 16–18px sheet padding, 24px between groups inside sheets.

**The Canvas Owns the Ground Rule.** Nothing frames the canvas. A new control goes into an existing edge slot or a new floating slot; it never becomes a bar that shrinks the viewport.

**The Play Steps Aside Rule.** In active Play the whole build HUD (top row, tool dock, hotbar, counts chip, views, status) is removed; Play brings its own controls.

## Elevation & Depth

Depth is ambient and navy-tinted: floating things cast soft, low-contrast shadows onto the scene haze so they read as held above the model. There are no hard or offset shadows. Chalk sheets cast more than navy slabs because they cover more of the model.

### Shadow Vocabulary

- **Slab** (`0 6px 18px rgba(20, 24, 36, 0.24)`): HUD slabs and the Export button.
- **Dock** (`0 8px 22px rgba(20, 24, 36, 0.26)`): the tool dock.
- **Sheet** (`0 10px 30px rgba(20, 24, 36, 0.22)`): docked desktop sheets, mode cards, save alerts (0.24).
- **Rising sheet** (`0 -10px 30px rgba(20, 24, 36, 0.24)`): touch sheets and mode cards rising from the bottom.
- **Hotbar lift** (`0 6px 12px rgba(10, 12, 20, 0.35)` with `translateY(-3px)`): the selected hotbar slot.
- **Swatch bevel** (`inset 0 -3px 0 rgba(0, 0, 0, 0.18)`): the hotbar colour swatch, giving it a moulded underside.

### Named Rules

**The Recede Rule.** While a pointer or finger drags on the canvas, every HUD element fades to 0.18 opacity and becomes click-through (150ms ease-out), then restores after release. New HUD elements must join this behaviour.

## Shapes

Friendly, chunky rounding that scales with surface size: 8px for fields and small view buttons, 10px for keys (mode tabs, tools, hotbar slots), 12px for part cards and the view strip, 14px for slabs, 16px for the tool dock and desktop sheets, 18px for touch sheets and the welcome card (top corners only when a sheet is attached to the bottom edge). Status and counts chips are full pills. Outlines are 2px everywhere in the HUD world (slab outlines, part-card borders, tool dividers, hotbar keys). Disclosure markers are drawn as a rotated 2px corner, not a text glyph.

## Components

### Buttons

Solid, key-like and bold.

- **Shape:** slab rounding (14px) in the top row; key rounding (10px) inside docks; phone header keys 12px.
- **Primary:** Commit Grass with white 650-weight text, 48px tall in the top row, slab shadow.
- **Slab button:** HUD Slab fill, 2px HUD Line outline, chalk text and icon; hover to HUD Slab Hover.
- **Focus:** 3px Sun Gold outline at 2px offset on every button, input, select, link and summary.
- **Inside chalk sheets:** white buttons with a 1px Sheet Line border, 44px minimum.

### Chips

- **Filter chips** (All, Bricks, Plates, Favourites and related parts): pill (18px) white chips on chalk; pressed state inverts to Ink Navy with chalk text. 36px tall on fine pointers, 44px on coarse pointers.
- **Status toast:** a navy pill (34px, 30px on touch) in the bottom-right corner that appears for about 4 seconds after each change, then fades; its text is always in a live region, so it is announced even when hidden.
- **Counts chip:** navy pill bottom left with tabular part and selection counts.

### Cards / Containers

- **Sheets:** chalk ground, ink text, no border, sheet shadow; 300–310px docks on desktop, rising sheets with a 44×5px handle on touch.
- **Part cards:** white, 2px Sheet Line border, 12px rounding; chosen state takes a Lit Grass border plus a 1px inset grass ring and a Commit Grass check.
- **Welcome card:** chalk, 18px rounding, 28px padding, centred on the empty canvas with one Commit Grass action.

### Inputs / Fields

- **Style:** on sheets, white fields with a 1px Sheet Line border, 6–8px rounding, 44px tall. The project name on the navy slab is borderless and transparent, showing an 8% chalk wash on hover and focus.
- **Focus:** the Sun Gold ring.

### Navigation

- **Mode switcher:** a navy slab with 40px tabs in HUD Mute that turn chalk-filled with ink text when active. On phones only the active tab shows, with a chevron; tapping opens a vertical list of all five modes with 46px rows.
- **Segmented tabs (Layers / Inspector):** a recessed Tab Well track with the active segment in Ink Navy.

### Tool Dock (signature)

A navy dock of labelled keys grouped by 2px dividers: Select/Place/Paint/Navigate, Undo/Redo, then Fit view, Camera views and Rectangular fill. The held tool is Lit Grass with dark ink. On touch it becomes a right-edge column of 46px icon keys whose names stay accessible.

### Hotbar (signature)

A 64px navy bar of 48px keys along the bottom on touch: a colour slot (a bevelled swatch), recently held parts, then Parts, Layers and Inspect. Keys have a 2px chalk-tinted outline over a 5% chalk wash. The active or held key takes a Sun Gold border, a gold wash, a 3px lift and the hotbar lift shadow (180ms ease-out).

### Icons

Authored set on a 24px grid, 2px stroke, round caps and joins, currentColor, `aria-hidden`; 20px by default, 16px inside part cards. Icons inside text buttons sit on the baseline (-3px).

## Do's and Don'ts

### Do:

- **Do** keep the canvas full-bleed and put every new control in a floating edge slot 12px from the viewport edge.
- **Do** use HUD Slab navy with a 2px HUD Line outline for controls and chalk sheets for content.
- **Do** give the held tool Lit Grass with Lit Grass Ink text, and every commit Commit Grass with white text.
- **Do** ring focus with 3px Sun Gold at 2px offset, and mark the held hotbar slot with a gold border, a 3px lift and the lift shadow.
- **Do** draw icons from the authored 24px, 2px-stroke set and draw disclosure chevrons in CSS.
- **Do** keep touch keys at 44px or more (46px tool keys, 48px hotbar and header keys) and keep labels accessible when they are visually hidden.
- **Do** make new HUD elements dim with the Recede Rule and hide during active Play.
- **Do** show status as a transient toast (about 4s) while keeping it permanently in a live region.

### Don't:

- **Don't** frame the canvas with a header bar, fixed sidebars or a permanent status bar.
- **Don't** put white text on Lit Grass, or use Lit Grass for commit buttons.
- **Don't** fill panels or large areas with Sun Gold; it rings and outlines.
- **Don't** use text characters (arrows, plus signs, stars, triangles) as icons or disclosure markers.
- **Don't** add small uppercase or letter-spaced labels above headings.
- **Don't** imitate LEGO logos, wordmarks or trade dress. The generic studded-brick silhouette in the authored Place and Parts icons is the world's own drawing and stays.
- **Don't** load webfonts from third parties; use the system stack or a self-hosted face.
- **Don't** stretch touch sheets past 680px on tablets; the model must stay visible beside them.
