---
version: 1
slug: "src-ui-app-tsx"
primary_target: "src/ui/App.tsx"
related_targets: ["src/ui/styles.css"]
---

# Surface brief: editor app shell (all modes)

Scope: the whole editor shell (Build, Instructions, Photo, Play, Project) at desktop, tablet and phone. Visitor mode: Operate.
Audience and job: hobbyist builders (and kids with a parent) open a build to view, explore and lightly edit it on phones, and to build fully on desktop and tablet.
Constraints: every existing capability stays reachable; the 3D canvas takes the whole screen on phones; touch targets are at least 44px; nothing depends on hover; the look is neither cold/CAD-like nor LEGO trade dress; fonts are self-hosted or system; strict CSP; Playwright tests rely on accessible names.
User decisions: one compact mode switcher; the HUD fades while a finger or pointer drags on the canvas; creative-mode HUD world chosen (seed e0907236, kind pick).

## Direction contract

THESIS: The build is the world and the interface is a HUD laid over it. There is no frame around the canvas: the category default of a header, sidebars and status bars boxing in a small viewport is refused. Controls sit in slots at the screen edges and dim while you work the model.

OWN-WORLD: Deep ink-navy HUD slabs (#1d2230) at high opacity with crisp 2px slot outlines. Chalk text (#f4f1ea). Grass green (#5bb56a) marks the active tool, selection and commit. Sun gold (#ffd166) rings the selected hotbar slot and warnings. Panels are chalk inventory sheets with navy ink. Authored 2px-stroke SVG icons; one sturdy sans in bold for HUD labels, with tabular numerals.

STORY: The visitor sees their model first, understands the tool they hold from the lit slot, and reaches parts, colours, layers and properties from a hotbar at the thumb edge, without leaving the model.

FIRST VIEWPORT: Phone 390×844: the canvas fills 100% of the screen. At the top left is a mode chip (icon and mode name) that opens the switcher with all five modes present and the current one struck forward. At the top right are save-state and export slots. A right-edge tool column holds Select/Place/Paint/Navigate, Undo/Redo and View. At the bottom is a 64px hotbar: the current colour, recent parts, and Parts/Layers/Inspector slots. Sheets rise at half height with a handle to full. Desktop: the same HUD, with the parts inventory docked left and properties docked right as chalk sheets over a full-bleed canvas.

FORM: Creative-mode HUD, candidate 1 on my ordered list (the pick card), seed key e0907236.

SIGNATURE INTERACTION: A pointer or finger dragging on the canvas dims the whole HUD to about 20% and makes it click-through within 150ms, then restores it 250ms after release. The selected hotbar slot lifts with a gold ring.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
