# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: visitors browsing agents’ responses to the same brick-building prompt, and hobbyist brick builders designing their own models (MOCs) or importing existing LDraw/MPD builds, such as a multi-storey Santorini house with interiors, on desktop and on phones. They build, inspect, explore their creations in first/third person Play, and export parts lists to buy the bricks.

Secondary: younger builders (kids, often with a parent) who build playfully. For them, forgiving interactions, plain words and big targets matter more than precision tools.

On a phone the main job, once a build is open, is to view, explore and make light edits: orbit and inspect the model, walk it in Play, and occasionally place, move or recolour a part. Full-scale building happens mostly on desktop or tablet.

## Product Purpose

A browser-based, offline-capable gallery and brick-building editor that works with real LDraw geometry. Gallery visitors compare generated interpretations of a prompt and open any response in the interactive model tools. It covers building, instructions, photos, Play and parts lists (BrickLink Wanted List) for the same model, with no account and no install. Success means a builder can open their model on any device, see it large and correctly, explore it, and change it safely: every change is undoable and projects are saved locally with native backups.

## Positioning

It is a single static web app that edits real LDraw source without losing any of it, renders large imported builds (up to 200,000 parts on desktop, 150,000 on phones), and lets you walk around inside the build in Play. It also produces an occurrence-accurate BrickLink parts list. Everything runs locally in the browser.

## Operating Context

- Devices: desktop (mouse and keyboard, 1440px-class), tablets (1080×1800 touch) and phones (360–430px wide touch, including high-end phones from the last two years). Layout adapts to available width, not the user agent.
- Primary modes: Gallery and Play. Gallery browses and compares generated responses to a shared prompt; Build, Instructions, Photo and Project remain tools for the same open model. Play provides first/third person walking, vehicles, seats and doors.
- Files: LDraw `.ldr` / `.mpd` / `.dat` imports, official LEGO set models from the LDraw OMR, build scripts (`.json`), native `.brickproj` backups, LDraw/MPD export, PNG/PDF/HTML instructions, BrickLink Wanted List XML, parts-list CSV and Rebrickable CSV.
- Storage: local projects in IndexedDB; an opt-in automation API (`?automation=1`) and CLI for agents and tests.
- Device resource profiles: phones use tighter "phone limits" and can opt into desktop limits after acknowledging the risk.

## Capabilities and Constraints

- The 3D canvas (Three.js/WebGL2) is the product surface. On phones it must get as much of the screen as possible; chrome should recede when it is not being used.
- Touch targets must be at least 44 CSS px, and nothing essential may depend on hover, right-click or keyboard modifiers (spec §8.1). Test at 360px, tablet and desktop widths.
- A phone keeps Place, Select, Paint and Undo/Redo reachable without opening a menu, uses bottom sheets for the catalogue, layers and numeric properties, and shows a contextual action strip after selection (spec §8.1).
- Automated browser tests (Playwright) depend on accessible names and roles, so renaming controls needs matching test updates.
- The placeable catalogue has 224 curated parts, and every other official LDraw part loads on demand from the complete library; connector snapping covers studs, side studs, jumpers, door hinges and train track (not clips, bars, brick hinges or Technic).
- Static hosting on Cloudflare Pages (bricks.robertj.in) with a strict CSP; no third-party runtime assets (official set models come through the same-origin `/api/omr` proxy), fonts must be self-hosted, and there is no telemetry.

## Brand Commitments

- Keep the product name "brickeditor" (Brick Editor). The logo, colours and typography may be replaced.
- Never imitate LEGO trademarks, logos or trade dress. The app uses its own name and original artwork.

## Evidence on Hand

- `spec.md` (full product specification) and `docs/STATUS.md` (implemented versus remaining).
- The supplied Santorini v2 MPD set and its preview renders (user files; do not redistribute).
- There are no testimonials, user counts or benchmarks; do not fabricate any.

## Product Principles

1. The build is the hero. Chrome exists to serve the model and gets out of its way, especially on phones.
2. Safe to explore. Every change is undoable, source is never silently lost, and risky choices are explained in plain words.
3. One model, many views. Build, Instructions, Photo, Play and Parts are views of the same source, not separate products.
4. Friendly to both hobbyists and kids. Precision exists, but it is never required.
5. Honest about limits. Budgets, missing parts and unverified features are shown plainly rather than hidden.

## Accessibility & Inclusion

Controls have accessible labels and roles, focus is preserved when panels open and close, status is announced for selection, placement and save, and targets are at least 44 px. Children and non-expert users need plain language (studs and bricks, not LDU jargon, in primary UI).
